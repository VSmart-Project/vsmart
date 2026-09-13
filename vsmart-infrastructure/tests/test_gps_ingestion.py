"""Offline tests: load the real Lambda with AWS transports replaced by mocks."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]


def load_handler():
    boto = types.ModuleType("boto3")
    boto.client = MagicMock()
    boto.resource = MagicMock()
    conditions = types.ModuleType("boto3.dynamodb.conditions")
    conditions.Attr = MagicMock()
    exceptions = types.ModuleType("botocore.exceptions")
    exceptions.ClientError = type("ClientError", (Exception,), {})
    replacements = {"boto3": boto, "boto3.dynamodb": types.ModuleType("boto3.dynamodb"),
                    "boto3.dynamodb.conditions": conditions,
                    "botocore": types.ModuleType("botocore"), "botocore.exceptions": exceptions}
    spec = importlib.util.spec_from_file_location("gps_ingest", ROOT / "lambda/iot-message-processor/index.py")
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, replacements):
        spec.loader.exec_module(module)
    return module


class GpsIngestionTests(unittest.TestCase):
    def setUp(self):
        self.m = load_handler()
        self.m.DEVICE_STATE_TABLE = "state"
        self.m.REALTIME_ENABLED = True
        self.m._get_device_metadata = MagicMock(return_value={"ownerUserId": "real-owner", "displayName": "GPS"})
        self.m._put_device_state = MagicMock()
        self.m._publish = MagicMock()
        self.m._call_webhook = MagicMock()
        self.m.update_device_position = MagicMock(return_value={})

    def payload(self):
        return {"deviceid": "gps-1", "timestamp": 1789214400,
                "location": {"lat": 10.8, "long": 106.8},
                "positionProperties": dict(speed="0", heading="90", status="stationary", reason="sample",
                                           **{f"diagnostic{i}": "42" for i in range(11)})}

    def health(self):
        return {"messageType": "gps_health", "sourceDeviceId": "gps-1", "deviceid": "gps-1",
                "ownerUserId": "spoofed-owner", "gps": {"valid": False, "fix": "none", "hdop": 99.99},
                "lastKnown": {"lat": 0, "long": 0, "ageS": 1}}

    def test_location_contract_and_utc(self):
        u = self.m.build_location_update(self.payload())
        self.assertEqual(u["Position"], [106.8, 10.8])
        self.assertEqual(u["SampleTime"], "2026-09-12T12:00:00Z")
        self.assertEqual(set(u["PositionProperties"]), {"speed", "heading", "status", "reason"})
        for key, value in u["PositionProperties"].items():
            self.assertIsInstance(value, str)

    def test_invalid_times_and_coordinates(self):
        for timestamp in (0, True, float("nan"), "1970-01-01T00:00:00Z", "2026-09-12T12:00:00"):
            p = self.payload(); p["timestamp"] = timestamp
            with self.subTest(timestamp=timestamp), self.assertRaises(ValueError):
                self.m.build_location_update(p)
        for lat, lng in ((91, 0), (0, 181), (float("nan"), 0)):
            p = self.payload(); p["location"] = {"lat": lat, "long": lng}
            with self.assertRaises(ValueError): self.m.build_location_update(p)

    def test_health_updates_reachability_without_position(self):
        result = self.m.lambda_handler(self.health(), None)
        self.assertEqual(result["statusCode"], 200)
        self.m.update_device_position.assert_not_called()
        device, update = self.m._put_device_state.call_args.args
        self.assertEqual(device, "gps-1")
        self.assertEqual(update["ownerUserId"], "real-owner")
        self.assertTrue(update["isOnline"])
        for key in ("position", "sampleTime", "positionProperties", "lastKnown"):
            self.assertNotIn(key, update)
        topic, evt = self.m._publish.call_args.args
        self.assertEqual(topic, "users/real-owner/events")
        self.assertEqual(evt["type"], "device.online")
        self.assertFalse(evt["payload"]["gpsHealth"]["valid"])

    def test_health_rejects_mismatched_identity(self):
        e = self.health(); e["deviceid"] = "other-device"
        self.assertEqual(self.m.lambda_handler(e, None)["statusCode"], 400)
        self.m._put_device_state.assert_not_called()

    def test_health_rejects_unregistered_and_bad_shape(self):
        self.m._get_device_metadata.return_value = {}
        self.assertEqual(self.m.lambda_handler(self.health(), None)["statusCode"], 400)
        self.m._get_device_metadata.return_value = {"ownerUserId": "owner"}
        e = self.health(); e["gps"]["valid"] = "false"
        self.assertEqual(self.m.lambda_handler(e, None)["statusCode"], 400)
        self.m._put_device_state.assert_not_called()

    def test_health_state_failure_propagates_for_retry(self):
        self.m._put_device_state.side_effect = RuntimeError("DynamoDB unavailable")
        with self.assertRaises(RuntimeError): self.m.lambda_handler(self.health(), None)
        self.m._publish.assert_not_called()

    def test_position_pipeline_accepts_legacy_diagnostics(self):
        self.m._process_antitheft = MagicMock()
        self.assertEqual(self.m.lambda_handler({"payload": self.payload()}, None)["statusCode"], 200)
        update = self.m.update_device_position.call_args.args[0]
        self.assertEqual(len(update["PositionProperties"]), 4)


if __name__ == "__main__":
    unittest.main()
