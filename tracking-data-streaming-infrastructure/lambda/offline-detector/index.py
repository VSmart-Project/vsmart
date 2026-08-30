import json
import os
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3
from boto3.dynamodb.types import TypeDeserializer


REALTIME_ENABLED = os.environ.get("REALTIME_ENABLED", "false").lower() == "true"
DEVICE_STATE_TABLE = os.environ.get("DEVICE_STATE_TABLE", "")
DEVICES_TABLE = os.environ.get("DEVICES_TABLE", "")
APP_EVENTS_TOPIC_TEMPLATE = os.environ.get("APP_EVENTS_TOPIC_TEMPLATE", "users/{userId}/events")
DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE = os.environ.get(
    "DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE", "devices/{deviceId}/events"
)
OFFLINE_TIMEOUT_SECONDS = int(os.environ.get("OFFLINE_TIMEOUT_SECONDS", "120"))
BACKEND_WEBHOOK_URL = os.environ.get("BACKEND_WEBHOOK_URL", "")
BACKEND_WEBHOOK_KEY = os.environ.get("BACKEND_WEBHOOK_KEY", "")


dynamodb = boto3.resource("dynamodb")
iot = boto3.client("iot")
iot_data = None


def _now_ms() -> int:
    return int(time.time() * 1000)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    _get_iot_data_client().publish(topic=topic, qos=0, payload=data.encode("utf-8"))


def _call_webhook(event: Dict[str, Any]) -> None:
    if not BACKEND_WEBHOOK_URL:
        return
    if len(BACKEND_WEBHOOK_KEY) < 32:
        raise RuntimeError("BACKEND_WEBHOOK_KEY must contain at least 32 characters")
    request = urllib.request.Request(
        BACKEND_WEBHOOK_URL,
        data=json.dumps(event, separators=(",", ":"), ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-api-key": BACKEND_WEBHOOK_KEY},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=3):
        pass


def _get_device_owner(device_id: str) -> Optional[str]:
    if not DEVICES_TABLE:
        return None
    table = dynamodb.Table(DEVICES_TABLE)
    r = table.get_item(Key={"deviceId": device_id})
    item = r.get("Item") or {}
    return item.get("ownerUserId")


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(
        json.dumps(
            {
                "message": "OfflineDetector invoked",
                "realtimeEnabled": REALTIME_ENABLED,
                "deviceStateTable": DEVICE_STATE_TABLE,
                "offlineTimeoutSeconds": OFFLINE_TIMEOUT_SECONDS,
                "invocation": event,
            },
            default=str,
        )
    )

    if not REALTIME_ENABLED:
        return {"statusCode": 200, "body": json.dumps({"skipped": True, "reason": "REALTIME_ENABLED=false"})}

    if not DEVICE_STATE_TABLE:
        raise RuntimeError("Missing DEVICE_STATE_TABLE env var")

    state_table = dynamodb.Table(DEVICE_STATE_TABLE)
    cutoff_ms = _now_ms() - OFFLINE_TIMEOUT_SECONDS * 1000

    # We query items that are currently online using GSI index
    paginator = state_table.meta.client.get_paginator("query")
    deserializer = TypeDeserializer()
    items = []
    for page in paginator.paginate(
        TableName=DEVICE_STATE_TABLE,
        IndexName="isOnlineStr-lastSeenAtMs-index",
        KeyConditionExpression="isOnlineStr = :online AND lastSeenAtMs < :cutoff",
        ExpressionAttributeValues={
            ":online": {"S": "true"},
            ":cutoff": {"N": str(cutoff_ms)},
        },
        ProjectionExpression="deviceId,lastSeenAtMs,isOnline,ownerUserId",
    ):
        items.extend(
            {
                key: deserializer.deserialize(value)
                for key, value in raw_item.items()
            }
            for raw_item in page.get("Items") or []
        )
    published = 0

    for item in items:
        device_id = item.get("deviceId")
        last_seen_at_ms = int(item.get("lastSeenAtMs") or 0)
        owner_user_id = item.get("ownerUserId") or _get_device_owner(device_id)

        evt = {
            "version": 1,
            "eventId": f"evt-offline-{uuid.uuid4()}",
            "type": "device.offline",
            "timestamp": _now_ms(),
            "userId": owner_user_id or "unknown",
            "deviceId": device_id,
            "payload": {
                "lastSeenAt": datetime.fromtimestamp(last_seen_at_ms / 1000, tz=timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            },
        }

        # If we don't know the owner yet, publish only to debug topic (still useful for validation).
        if owner_user_id:
            _publish(_user_topic(owner_user_id), evt)
        _publish(_debug_topic(device_id), evt)
        _call_webhook(evt)

        # Persist offline state so we don't spam.
        state_table.update_item(
            Key={"deviceId": device_id},
            UpdateExpression="SET isOnline = :offline, isOnlineStr = :offlineStr, offlineNotifiedAt = :t, updatedAt = :u",
            ExpressionAttributeValues={
                ":offline": False,
                ":offlineStr": "false",
                ":t": _iso_now(),
                ":u": _iso_now(),
            },
        )
        published += 1

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "checked": len(items),
                "published": published,
                "cutoffMs": cutoff_ms,
            }
        ),
    }

