#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#include <TinyGPS++.h>
#include "secrets.h"

// MQTT topics
#define AWS_IOT_PUBLISH_TOPIC   "location"
#define AWS_IOT_SUBSCRIBE_TOPIC "esp32/sub"

WiFiClientSecure net = WiFiClientSecure();
PubSubClient client(net);

// GPS instance and hardware serial (UART 2)
TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

// Variables for filtering GPS drift
double lastPublishedLat = 0.0;
double lastPublishedLng = 0.0;
unsigned long lastPublishTime = 0;

unsigned long lastMillis = 0;

void messageHandler(char* topic, byte* payload, unsigned int length) {
  Serial.print("Incoming message on topic: ");
  Serial.println(topic);

  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("Payload: ");
  Serial.println(message);
}

void connectAWS() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to Wi-Fi!");

  // Synchronize time using NTP to validate certificates correctly
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Waiting for NTP time sync: ");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("");
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  Serial.print("Current time: ");
  Serial.print(asctime(&timeinfo));

  // Configure WiFiClientSecure with the AWS IoT credentials
  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);

  // Connect to the MQTT broker on the AWS endpoint
  client.setServer(AWS_IOT_ENDPOINT, 8883);

  // Set the message callback handler
  client.setCallback(messageHandler);

  Serial.println("Connecting to AWS IoT Core...");

  while (!client.connect(AWS_IOT_CLIENT_ID)) {
    Serial.print("MQTT connection failed, error code: ");
    Serial.print(client.state());
    Serial.println(" - Retrying in 5 seconds...");
    delay(5000);
  }

  Serial.println("AWS IoT Core Connected!");


  // Subscribe to a topic
  client.subscribe(AWS_IOT_SUBSCRIBE_TOPIC);
}

void publishMessage() {
  if (!gps.location.isValid() || gps.location.age() > 5000 || gps.satellites.value() < 4 || gps.hdop.hdop() > 5.0) {
    Serial.printf("GPS data skipped/low quality (valid: %d, age: %lu ms, sats: %d, hdop: %.2f, chars: %lu). Skipping publish.\n", 
                  gps.location.isValid(), gps.location.age(), gps.satellites.value(), gps.hdop.hdop(), gps.charsProcessed());
    return;
  }

  double lat = gps.location.lat();
  double lng = gps.location.lng();
  float speed = gps.speed.kmph();

  // Calculate distance from the last published coordinates
  double distance = 0.0;
  if (lastPublishedLat != 0.0 && lastPublishedLng != 0.0) {
    distance = TinyGPSPlus::distanceBetween(lat, lng, lastPublishedLat, lastPublishedLng);
  }

  // Filter speed noise (speed clamping)
  if (speed < 1.5) {
    speed = 0.0;
  }

  bool shouldPublish = false;
  unsigned long nowMillis = millis();

  // Decide whether to publish based on movement
  if (lastPublishedLat == 0.0 || lastPublishedLng == 0.0) {
    // First time publishing
    shouldPublish = true;
  } else if (distance >= 10.0 && speed >= 1.5) {
    // Device is actively moving (both speed and distance exceeded to prevent drift)
    shouldPublish = true;
  } else if (nowMillis - lastPublishTime >= 60000) {
    // Heartbeat every 60 seconds (keeps marker online, but doesn't drift)
    lat = lastPublishedLat;
    lng = lastPublishedLng;
    speed = 0.0;
    shouldPublish = true;
  }

  if (!shouldPublish) {
    Serial.printf("Stationary GPS drift detected (dist: %.2fm, speed: %.2f km/h). Skipping publish to keep map clean.\n", distance, speed);
    return;
  }

  // Update tracking variables
  lastPublishedLat = lat;
  lastPublishedLng = lng;
  lastPublishTime = nowMillis;

  time_t now = time(nullptr);
  Serial.printf("Publishing real GPS data: lat=%.6f, lng=%.6f, speed=%.2f km/h (moved %.2fm), satellites=%d\n", lat, lng, speed, distance, gps.satellites.value());

  // Create JSON payload matching the expected format:
  // {
  //     "payload": {
  //         "deviceid": "esp32_device",
  //         "timestamp": 1713812103,
  //         "location": {
  //             "lat": 10.848073,
  //             "long": 106.786433
  //         },
  //         "positionProperties": {
  //             "speed": "0.00"
  //         }
  //     }
  // }
  String payload = "{\"payload\":{";
  payload += "\"deviceid\":\"" + String(AWS_IOT_CLIENT_ID) + "\",";
  payload += "\"timestamp\":" + String((long)now) + ",";
  payload += "\"location\":{";
  payload += "\"lat\":" + String(lat, 6) + ",";
  payload += "\"long\":" + String(lng, 6);
  payload += "},";
  payload += "\"positionProperties\":{";
  payload += "\"speed\":\"" + String(speed, 2) + "\"";
  payload += "}";
  payload += "}}";

  Serial.print("Publishing message: ");
  Serial.println(payload);
  
  if (client.publish(AWS_IOT_PUBLISH_TOPIC, payload.c_str())) {
    Serial.println("Publish successful");
  } else {
    Serial.println("Publish failed");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize GPS Hardware Serial (UART2): RX = GPIO16, TX = GPIO17
  GPSSerial.begin(9600, SERIAL_8N1, 16, 17);
  Serial.println("GPS UART initialized.");

  connectAWS();
}

void loop() {
  // Read and process GPS data
  while (GPSSerial.available()) {
    gps.encode(GPSSerial.read());
  }

  // If connection is lost, reconnect
  if (!client.connected()) {
    connectAWS();
  }
  client.loop();

  // Publish a message every 3 seconds
  if (millis() - lastMillis > 3000) {
    lastMillis = millis();
    publishMessage();
  }
}