#include <TinyGPS++.h>

TinyGPSPlus gps;

// UART2
HardwareSerial GPSSerial(2);

void setup()
{
    Serial.begin(115200);

    // RX = GPIO16, TX = GPIO17
    GPSSerial.begin(9600, SERIAL_8N1, 16, 17);

    Serial.println("GPS Started...");
}

void loop()
{
    while (GPSSerial.available())
    {
        gps.encode(GPSSerial.read());
    }

    if (gps.location.isUpdated())
    {
        Serial.print("Latitude : ");
        Serial.println(gps.location.lat(), 6);

        Serial.print("Longitude: ");
        Serial.println(gps.location.lng(), 6);

        Serial.print("Satellites: ");
        Serial.println(gps.satellites.value());

        Serial.print("Altitude : ");
        Serial.print(gps.altitude.meters());
        Serial.println(" m");

        Serial.println("--------------------------");
    }
}