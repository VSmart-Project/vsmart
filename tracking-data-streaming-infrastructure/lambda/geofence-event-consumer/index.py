import json
import os
import urllib.request
import time
import uuid
import ast
from typing import Any, Dict, Optional

import boto3


REALTIME_ENABLED = os.environ.get("REALTIME_ENABLED", "false").lower() == "true"
DEVICE_STATE_TABLE = os.environ.get("DEVICE_STATE_TABLE", "")
DEVICES_TABLE = os.environ.get("DEVICES_TABLE", "")
GEOFENCE_QUEUE_URL = os.environ.get("GEOFENCE_QUEUE_URL", "")
GEOFENCE_COLLECTION = os.environ.get("GEOFENCE_COLLECTION", "")
APP_EVENTS_TOPIC_TEMPLATE = os.environ.get("APP_EVENTS_TOPIC_TEMPLATE", "users/{userId}/events")
DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE = os.environ.get(
    "DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE", "devices/{deviceId}/events"
)

dynamodb = boto3.resource("dynamodb")
iot = boto3.client("iot")
location = boto3.client("location")
iot_data = None


def _now_ms() -> int:
    return int(time.time() * 1000)


def _get_iot_data_client():
    global iot_data
    if iot_data is not None:
        return iot_data
    endpoint = iot.describe_endpoint(endpointType="iot:Data-ATS")["endpointAddress"]
    iot_data = boto3.client("iot-data", endpoint_url=f"https://{endpoint}")
    return iot_data


def _user_topic(user_id: str) -> str:
    return APP_EVENTS_TOPIC_TEMPLATE.replace("{userId}", user_id)


def _debug_topic(device_id: str) -> str:
    return DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE.replace("{deviceId}", device_id)


def _publish(topic: str, payload: Dict[str, Any]) -> None:
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False, default=str)
    _get_iot_data_client().publish(topic=topic, qos=0, payload=data.encode("utf-8"))


def _get_owner_user_id(device_id: str) -> Optional[str]:
    # 1) Try DeviceStateTable cache
    if DEVICE_STATE_TABLE:
        state_table = dynamodb.Table(DEVICE_STATE_TABLE)
        r = state_table.get_item(Key={"deviceId": device_id})
        item = r.get("Item") or {}
        if item.get("ownerUserId"):
            return item.get("ownerUserId")

    # 2) Fallback DevicesTable
    if DEVICES_TABLE:
        devices_table = dynamodb.Table(DEVICES_TABLE)
        r = devices_table.get_item(Key={"deviceId": device_id})
        item = r.get("Item") or {}
        return item.get("ownerUserId")

    return None


def _get_geofence_owner(geofence_id: str) -> Optional[str]:
    if not GEOFENCE_COLLECTION:
        raise RuntimeError("Missing GEOFENCE_COLLECTION env var")
    try:
        response = location.get_geofence(
            CollectionName=GEOFENCE_COLLECTION,
            GeofenceId=geofence_id,
        )
    except location.exceptions.ResourceNotFoundException:
        return None
    return (response.get("GeofenceProperties") or {}).get("ownerUserId")


def _parse_geofence_event(body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # EventBridge -> SQS body commonly contains: { "detail": {...}, "detail-type": ..., ... }
    detail = body.get("detail") if isinstance(body, dict) else None
    if not isinstance(detail, dict):
        detail = body

    device_id = detail.get("DeviceId") or detail.get("deviceId")
    geofence_id = detail.get("GeofenceId") or detail.get("geofenceId")
    event_type = (detail.get("EventType") or detail.get("eventType") or "").upper()
    position = detail.get("Position") or detail.get("position")

    if not device_id or not geofence_id:
        return None

    if event_type in ("ENTERED", "EXITED"):
        event_type = "ENTER" if event_type == "ENTERED" else "EXIT"

    if event_type not in ("ENTER", "EXIT"):
        action = (detail.get("Action") or detail.get("action") or "").upper()
        if action in ("ENTER", "EXIT"):
            event_type = action

    if event_type not in ("ENTER", "EXIT"):
        return None

    return {
        "deviceId": device_id,
        "geofenceId": geofence_id,
        "eventType": event_type,
        "position": position,
    }


def _decode_record_body(raw_body: str) -> Dict[str, Any]:
    try:
        return json.loads(raw_body)
    except json.JSONDecodeError:
        # Fallback for manual SQS tests that used Python/object-style payloads with single quotes.
        parsed = ast.literal_eval(raw_body)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError("Decoded body is not an object")


BACKEND_WEBHOOK_URL = os.environ.get("BACKEND_WEBHOOK_URL", "")
BACKEND_WEBHOOK_KEY = os.environ.get("BACKEND_WEBHOOK_KEY", "")


def _call_webhook(evt: Dict[str, Any]) -> None:
    if not BACKEND_WEBHOOK_URL:
        return
    if len(BACKEND_WEBHOOK_KEY) < 32:
        raise RuntimeError("BACKEND_WEBHOOK_KEY must contain at least 32 characters")
    data = json.dumps(evt, separators=(",", ":"), ensure_ascii=False, default=str)
    req = urllib.request.Request(
        BACKEND_WEBHOOK_URL,
        data=data.encode("utf-8"),
        headers={"Content-Type": "application/json", "x-api-key": BACKEND_WEBHOOK_KEY},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=3):
        pass


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(
        json.dumps(
            {
                "message": "GeofenceEventConsumer invoked",
                "realtimeEnabled": REALTIME_ENABLED,
                "deviceStateTable": DEVICE_STATE_TABLE,
                "geofenceQueueUrl": GEOFENCE_QUEUE_URL,
                "appEventsTopicTemplate": APP_EVENTS_TOPIC_TEMPLATE,
                "records": len(event.get("Records") or []),
            },
            default=str,
        )
    )

    if not REALTIME_ENABLED:
        return {"statusCode": 200, "body": json.dumps({"skipped": True, "reason": "REALTIME_ENABLED=false"})}

    published = 0
    failed_records = []

    for record in event.get("Records") or []:
        try:
            raw_body = record.get("body") or "{}"
            body = _decode_record_body(raw_body)
            parsed = _parse_geofence_event(body)
            if not parsed:
                print(f"[GeofenceEventConsumer] Ignored record, could not map payload: {raw_body}")
                continue

            device_id = parsed["deviceId"]
            geofence_id = parsed["geofenceId"]
            event_type = parsed["eventType"]
            position = parsed.get("position")

            owner_user_id = _get_owner_user_id(device_id)
            geofence_owner_user_id = _get_geofence_owner(geofence_id)
            if not owner_user_id or geofence_owner_user_id != owner_user_id:
                print(f"[GeofenceEventConsumer] Ignored geofence without matching ownership: {geofence_id}")
                continue

            evt = {
                "version": 1,
                "eventId": f"evt-gf-{uuid.uuid4()}",
                "type": "geofence.enter" if event_type == "ENTER" else "geofence.exit",
                "timestamp": _now_ms(),
                "userId": owner_user_id or "unknown",
                "deviceId": device_id,
                "payload": {
                    "geofenceId": geofence_id,
                    "position": position,
                },
            }

            if owner_user_id:
                _publish(_user_topic(owner_user_id), evt)
            _publish(_debug_topic(device_id), evt)
            
            # Forward to backend webhook
            _call_webhook(evt)
            published += 1

        except Exception as e:
            if record.get("messageId"):
                failed_records.append({"itemIdentifier": record["messageId"]})
            print(f"[GeofenceEventConsumer] Error: {str(e)} | raw_body={record.get('body')}")

    return {"batchItemFailures": failed_records}
