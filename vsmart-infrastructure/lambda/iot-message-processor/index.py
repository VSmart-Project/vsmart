"""
Lambda Function: IoT Message Processor
Xử lý MQTT messages từ AWS IoT Core và cập nhật vị trí thiết bị vào Amazon Location Service
"""

import json
import math
import os
import urllib.request
from datetime import datetime, timezone
from typing import Dict, Any, List
import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
import time
import uuid
from decimal import Decimal

# Khởi tạo Location Service client
location_client = boto3.client('location')

# Lấy tên Tracker từ environment variable
TRACKER_NAME = os.environ.get('TRACKER_NAME', 'Vsmart-Tracker')
DEVICE_STATE_TABLE = os.environ.get('DEVICE_STATE_TABLE', '')
DEVICES_TABLE = os.environ.get('DEVICES_TABLE', '')
APP_EVENTS_TOPIC_TEMPLATE = os.environ.get("APP_EVENTS_TOPIC_TEMPLATE", "users/{userId}/events")
DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE = os.environ.get(
    "DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE", "devices/{deviceId}/events"
)
REALTIME_ENABLED = os.environ.get("REALTIME_ENABLED", "false").lower() == "true"

dynamodb = boto3.resource("dynamodb")
iot = boto3.client("iot")
antitheft_sns = boto3.client("sns")
iot_data = None
ANTITHEFT_TOPIC_ARN = os.environ.get("ANTITHEFT_TOPIC_ARN", "")


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


BACKEND_WEBHOOK_URL = os.environ.get("BACKEND_WEBHOOK_URL", "")
BACKEND_WEBHOOK_KEY = os.environ.get("BACKEND_WEBHOOK_KEY", "")


def _call_webhook(evt: Dict[str, Any]) -> None:
    if not BACKEND_WEBHOOK_URL:
        return
    if len(BACKEND_WEBHOOK_KEY) < 32:
        raise RuntimeError("BACKEND_WEBHOOK_KEY must contain at least 32 characters")
    try:
        data = json.dumps(evt, separators=(",", ":"), ensure_ascii=False, default=str)
        req = urllib.request.Request(
            BACKEND_WEBHOOK_URL,
            data=data.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": BACKEND_WEBHOOK_KEY
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=3) as response:
            pass
    except Exception as e:
        print(f"[Webhook] Failed to call webhook: {str(e)}")


def _publish(topic: str, payload: Dict[str, Any]) -> None:
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False, default=str)
    _get_iot_data_client().publish(topic=topic, qos=0, payload=data.encode("utf-8"))


METADATA_CACHE = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

def _get_device_metadata(device_id: str, force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    cached = METADATA_CACHE.get(device_id)
    if not force_refresh and cached and (now - cached['ts'] < CACHE_TTL_SECONDS):
        return cached['data']

    if not DEVICES_TABLE:
        return {}
    table = dynamodb.Table(DEVICES_TABLE)
    r = table.get_item(Key={"deviceId": device_id})
    item = r.get("Item") or {}
    METADATA_CACHE[device_id] = {'data': item, 'ts': now}
    return item


def _haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_m = 6371000
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    )
    return earth_radius_m * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def _process_antitheft(meta: Dict[str, Any], device_id: str, position: List[float]) -> None:
    if not meta.get("antitheftEnabled") or len(position) != 2:
        return

    center_lat = meta.get("antitheftLat")
    center_lng = meta.get("antitheftLng")
    radius = meta.get("antitheftRadius")
    if center_lat is None or center_lng is None or radius is None:
        return

    current_lng, current_lat = position
    distance = _haversine_distance_m(
        float(center_lat), float(center_lng), float(current_lat), float(current_lng)
    )
    devices_table = dynamodb.Table(DEVICES_TABLE)

    if distance > float(radius) and not meta.get("antitheftAlerted"):
        try:
            devices_table.update_item(
                Key={"deviceId": device_id},
                UpdateExpression="SET antitheftAlerted = :alerted, updatedAt = :updated",
                ExpressionAttributeValues={
                    ":alerted": True,
                    ":updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
                ConditionExpression=Attr("antitheftEnabled").eq(True)
                & Attr("antitheftAlerted").eq(False),
            )
        except devices_table.meta.client.exceptions.ConditionalCheckFailedException:
            return

        message = (
            f'Anti-theft alert for {meta.get("displayName") or device_id}: '
            f"device moved {distance:.1f}m from its protected position "
            f"(radius {float(radius):.1f}m)."
        )
        if ANTITHEFT_TOPIC_ARN:
            antitheft_sns.publish(
                TopicArn=ANTITHEFT_TOPIC_ARN,
                Subject=f"Anti-theft alert: {device_id}"[:100],
                Message=message,
            )

        owner_user_id = meta.get("ownerUserId")
        if owner_user_id:
            event = {
                "version": 1,
                "eventId": f"evt-antitheft-{uuid.uuid4()}",
                "type": "antitheft.breach",
                "timestamp": _now_ms(),
                "userId": owner_user_id,
                "deviceId": device_id,
                "payload": {
                    "displayName": meta.get("displayName"),
                    "message": message,
                    "position": position,
                    "distanceM": round(distance, 1),
                },
            }
            if REALTIME_ENABLED:
                _publish(_user_topic(owner_user_id), event)
                _publish(_debug_topic(device_id), event)
            _call_webhook(event)
    elif distance <= float(radius) and meta.get("antitheftAlerted"):
        devices_table.update_item(
            Key={"deviceId": device_id},
            UpdateExpression="SET antitheftAlerted = :alerted, updatedAt = :updated",
            ExpressionAttributeValues={
                ":alerted": False,
                ":updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
            ConditionExpression=Attr("antitheftEnabled").eq(True),
        )


def _get_device_state(device_id: str) -> Dict[str, Any]:
    if not DEVICE_STATE_TABLE:
        return {}
    table = dynamodb.Table(DEVICE_STATE_TABLE)
    r = table.get_item(Key={"deviceId": device_id})
    return r.get("Item") or {}


def _put_device_state(device_id: str, patch: Dict[str, Any]) -> None:
    if not DEVICE_STATE_TABLE:
        return
    table = dynamodb.Table(DEVICE_STATE_TABLE)
    # Merge-patch style update (avoid overwriting unrelated fields).
    expr_parts = []
    names = {}
    values = {}

    merged_patch = {
        **patch,
        "updatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    for k, v in merged_patch.items():
        names[f"#{k}"] = k
        values[f":{k}"] = v
        expr_parts.append(f"#{k} = :{k}")

    table.update_item(
        Key={"deviceId": device_id},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )

def _process_health(event: Dict[str, Any]) -> Dict[str, Any]:
    """Refresh reachability independently of GPS fix. Never write a location."""
    # sourceDeviceId is added by the IoT rule from the MQTT topic; do not let
    # the body redirect updates to a different device or choose its owner.
    device_id = event.get("sourceDeviceId")
    if not isinstance(device_id, str) or not device_id or event.get("deviceid") != device_id:
        raise ValueError("Health deviceid must match the MQTT topic")
    meta = _get_device_metadata(device_id, force_refresh=True)
    owner_id = meta.get("ownerUserId")
    if not owner_id:
        raise ValueError("Health requires a registered device with an owner")
    if not DEVICE_STATE_TABLE:
        raise RuntimeError("DEVICE_STATE_TABLE is required for health updates")
    gps = event.get("gps")
    if not isinstance(gps, dict) or not isinstance(gps.get("valid"), bool):
        raise ValueError("Health requires gps.valid boolean")
    # Bounded scalar diagnostics only. Raw strings, coordinates and client
    # ownerUserId are never trusted as device metadata or measured positions.
    health = {"valid": gps["valid"]}
    for key in ("used", "solution", "tracked", "inView", "snr", "hdop", "hdopGsa", "ageMs", "baud", "nmea", "passed", "failed"):
        value = gps.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0:
            health[key] = Decimal(str(value))
    for key in ("silent", "locked", "gsvFresh"):
        if isinstance(gps.get(key), bool):
            health[key] = gps[key]
    if gps.get("fix") in ("none", "unknown", "2D", "3D"):
        health["fix"] = gps["fix"]
    received_ms = _now_ms()
    _put_device_state(device_id, {
        "ownerUserId": owner_id,
        "displayName": meta.get("displayName"),
        "type": meta.get("type"),
        "lastSeenAtMs": received_ms,
        "isOnline": True,
        "isOnlineStr": "true",
        "gpsHealth": health,
    })
    # Existing clients already handle device.online. Do not emit a fabricated
    # device.position.updated when GPS is unavailable.
    evt = {
        "version": 1, "eventId": f"evt-health-{uuid.uuid4()}",
        "type": "device.online", "timestamp": received_ms,
        "userId": owner_id, "deviceId": device_id,
        "payload": {"displayName": meta.get("displayName"), "isOnline": True,
                    "gpsHealth": health},
    }
    if REALTIME_ENABLED:
        _publish(_user_topic(owner_id), evt)
    _call_webhook(evt)
    return {"statusCode": 200, "body": json.dumps({"deviceId": device_id, "healthUpdated": True})}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main handler function
    
    Expected MQTT payload format:
    {
        "payload": {
            "deviceid": "Vehicle-1",
            "timestamp": 1713812103,
            "location": {
                "lat": 47.54372304079714,
                "long": -122.32275832917712
            },
            "accuracy": {
                "Horizontal": 20.5
            },
            "positionProperties": {
                "speed": "60",
                "heading": "180",
                "status": "moving"
            }
        }
    }
    """
    
    if event.get("messageType") == "gps_health":
        # Invalid requests are rejected; infrastructure errors propagate so
        # asynchronous Lambda invocation can retry them.
        try:
            return _process_health(event)
        except ValueError as exc:
            return {"statusCode": 400, "body": json.dumps({"error": str(exc)})}

    print(f"Received event: {json.dumps(event)}")
    
    try:
        # Validate input
        if 'payload' not in event:
            raise ValueError("Missing 'payload' in event")
        
        payload = event['payload']
        
        # Validate required fields
        required_fields = ['deviceid', 'timestamp', 'location']
        for field in required_fields:
            if field not in payload:
                raise ValueError(f"Missing required field: {field}")
        
        if 'lat' not in payload['location'] or 'long' not in payload['location']:
            raise ValueError("Missing 'lat' or 'long' in location")
        
        # Chuẩn bị update cho Location Service
        update = build_location_update(payload)
        
        # Gửi update đến Amazon Location Service
        response = update_device_position(update)
        
        device_id = payload["deviceid"]
        print(f"Successfully updated position for device: {device_id}")

        # Phase 2: publish normalized device.position.updated
        # Store state and publish to app topic (best-effort).
        try:
            meta = _get_device_metadata(device_id, force_refresh=True)
            owner_user_id = meta.get("ownerUserId")

            # Convert SampleTime to ISO (already ISO in build_location_update)
            sample_time_iso = update.get("SampleTime")
            position = update.get("Position")
            position_props = update.get("PositionProperties") or {}

            # Convert float positions to Decimal for DynamoDB compatibility
            position_db = [Decimal(str(coord)) for coord in position] if position else None

            # Persist latest state snapshot
            _put_device_state(
                device_id,
                {
                    "ownerUserId": owner_user_id,
                    "displayName": meta.get("displayName"),
                    "type": meta.get("type"),
                    "position": position_db,
                    "sampleTime": sample_time_iso,
                    "lastSeenAtMs": _now_ms(),
                    "isOnline": True,
                    "isOnlineStr": "true",
                    "positionProperties": position_props,
                },
            )

            _process_antitheft(meta, device_id, position)

            if REALTIME_ENABLED:
                evt = {
                    "version": 1,
                    "eventId": f"evt-pos-{uuid.uuid4()}",
                    "type": "device.position.updated",
                    "timestamp": _now_ms(),
                    "userId": owner_user_id or "unknown",
                    "deviceId": device_id,
                    "payload": {
                        "displayName": meta.get("displayName"),
                        "type": meta.get("type"),
                        "position": position,
                        "sampleTime": sample_time_iso,
                        "isOnline": True,
                        "antitheftEnabled": bool(meta.get("antitheftEnabled")),
                        "positionProperties": position_props,
                    },
                }

                if owner_user_id:
                    _publish(_user_topic(owner_user_id), evt)
                # Always publish to debug topic for validation.
                _publish(_debug_topic(device_id), evt)
                
                # Forward to backend webhook
                _call_webhook(evt)
        except Exception as pub_err:
            print(f"[Phase2] Failed to publish normalized event: {str(pub_err)}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Position updated successfully',
                'deviceId': device_id,
                'response': response
            }, default=str)
        }
        
    except ValueError as e:
        print(f"Validation error: {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Validation error',
                'message': str(e)
            })
        }
        
    except ClientError as e:
        print(f"AWS service error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'AWS service error',
                'message': str(e)
            })
        }
        
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


def build_location_update(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Xây dựng update object cho Location Service
    
    Args:
        payload: MQTT payload
        
    Returns:
        Update object theo format của BatchUpdateDevicePosition API
    """
    timestamp = payload['timestamp']
    if isinstance(timestamp, bool):
        raise ValueError("Invalid GPS timestamp")
    if isinstance(timestamp, (int, float)):
        if not math.isfinite(timestamp) or not 1600000000 < timestamp < 4102444800:
            raise ValueError("GPS timestamp is outside the supported range")
        sample_time = datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")
    elif isinstance(timestamp, str):
        try:
            parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if parsed.tzinfo is None or not 1600000000 < parsed.timestamp() < 4102444800:
                raise ValueError("Timestamp must include a timezone and valid date")
            sample_time = parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError as exc:
            raise ValueError("Invalid GPS timestamp") from exc
    else:
        raise ValueError("Invalid GPS timestamp")
    lat = float(payload['location']['lat'])
    lng = float(payload['location']['long'])
    if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise ValueError("Invalid GPS coordinates")

    # Build base update
    update = {
        "DeviceId": payload['deviceid'],
        "SampleTime": sample_time,
        "Position": [
            lng,  # Longitude first (GeoJSON format)
            lat   # Latitude second
        ]
    }
    
    # Add accuracy if present
    if 'accuracy' in payload:
        update['Accuracy'] = payload['accuracy']
    
    # Add position properties if present
    if 'positionProperties' in payload:
        # Location Service chỉ chấp nhận string values
        position_props = {}
        # Legacy firmware may still send 15 diagnostics. Location accepts at
        # most four properties; detailed GPS data now travels on health.
        for key in ("speed", "heading", "status", "reason"):
            value = payload['positionProperties'].get(key)
            if value is not None and 1 <= len(str(value)) <= 150:
                position_props[key] = str(value)
        update['PositionProperties'] = position_props
    
    return update


def update_device_position(update: Dict[str, Any]) -> Dict[str, Any]:
    """
    Gửi device position update đến Amazon Location Service
    
    Args:
        update: Update object
        
    Returns:
        Response from Location Service
    """
    try:
        response = location_client.batch_update_device_position(
            TrackerName=TRACKER_NAME,
            Updates=[update]
        )
        
        # Check for errors in response
        if response.get('Errors'):
            error = response['Errors'][0]
            raise Exception(f"Location Service error: {error.get('Error', {}).get('Message', 'Unknown error')}")
        
        return response
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"Failed to update device position: {error_code} - {error_message}")
        raise


def batch_update_multiple_devices(updates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Cập nhật vị trí cho nhiều thiết bị cùng lúc (tối đa 10 devices)
    
    Args:
        updates: List of update objects
        
    Returns:
        Response from Location Service
    """
    if len(updates) > 10:
        raise ValueError("Maximum 10 device updates per batch")
    
    try:
        response = location_client.batch_update_device_position(
            TrackerName=TRACKER_NAME,
            Updates=updates
        )
        
        # Log any errors
        if response.get('Errors'):
            for error in response['Errors']:
                device_id = error.get('DeviceId', 'Unknown')
                error_msg = error.get('Error', {}).get('Message', 'Unknown error')
                print(f"Error updating device {device_id}: {error_msg}")
        
        return response
        
    except ClientError as e:
        print(f"Batch update failed: {str(e)}")
        raise
