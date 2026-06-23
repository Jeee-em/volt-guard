#define ENABLE_USER_AUTH
#define ENABLE_DATABASE

#include <Arduino.h>
#include <math.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <FirebaseClient.h>
#include <LittleFS.h>
#include <time.h>

// ======================================
// WIFI / FIREBASE CREDENTIALS
// ======================================
#define HOST_NAME "OldBuilding"
#define WIFI_SSID "Joy2daworld.HEHE"
#define WIFI_PASSWORD "joy1234506789"

#define WEB_API_KEY "AIzaSyDH5gXQfISJg5M3qO8-2AHwikI8cWUnufo"
#define DATABASE_URL "https://voltguard-2026-default-rtdb.asia-southeast1.firebasedatabase.app"
#define USER_EMAIL "thesiswebsitemsu1@gmail.com"
#define USER_PASS "powermonitoring"

const char* DEVICE_ID = "power_monitor_03";
const char* CACHE_FILENAME = "/cache.bin";

// ======================================
// PINS & SAMPLING SETTINGS
// ======================================
const int IA_PIN = 34;
const int IC_PIN = 36;
const int VAB_PIN = 33;
const int VBC_PIN = 32;

const int numSamples = 1000;
const int sampleDelayMicros = 200;

// ======================================
// CALIBRATION & OFFSETS
// ======================================
float currentCalibration[2] = { 0.0899, 0.0654 };
float voltageCalibration[2] = { 0.554,  0.520  };

float VabOffset = 0;
float VbcOffset = 0;
float IaOffset = 0;
float IcOffset = 0;

// ======================================
// TIMERS & STATES
// ======================================
unsigned long lastUpload = 0;
const unsigned long uploadInterval = 20000; // 20 seconds
bool wifiConnected = false;

// ======================================
// FIREBASE GLOBALS
// ======================================
WiFiClientSecure ssl;
DefaultNetwork network;
AsyncClientClass aClient(ssl, getNetwork(network));
FirebaseApp app;
RealtimeDatabase Database;
FirebaseAuth user_auth;

// Callback required by FirebaseClient setup
void asyncCB(AsyncResult &aResult) {
  // Optional: Print auth token status here if needed
}

// ======================================
// DATA STRUCTURE
// ======================================
struct TwoWattmeterData {
  time_t timestamp;
  float Vab;
  float Vbc;
  float Ia;
  float Ic;
  float W1;
  float W2;
  float totalPower;
};

// ======================================
// OFFSET READING
// ======================================
float readOffset(int pin) {
  long sum = 0;
  for (int i = 0; i < numSamples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(sampleDelayMicros);
  }
  return sum / (float)numSamples;
}

// ======================================
// TWO-WATTMETER NUMERICAL INTEGRATION
// ======================================
TwoWattmeterData measureTwoWattmeter() {
  TwoWattmeterData meter;
  
  double sumVabSq = 0;
  double sumVbcSq = 0;
  double sumIaSq = 0;
  double sumIcSq = 0;
  double sumW1 = 0;
  double sumW2 = 0;

  for(int sample = 0; sample < numSamples; sample++) {
    float rawVab = analogRead(VAB_PIN);
    float rawVbc = analogRead(VBC_PIN);
    float rawIa = analogRead(IA_PIN);
    float rawIc = analogRead(IC_PIN);

    float Vab = (rawVab - VabOffset) * voltageCalibration[0];
    float Vbc = (rawVbc - VbcOffset) * voltageCalibration[1];
    float Ia = (rawIa - IaOffset) * currentCalibration[0];
    float Ic = (rawIc - IcOffset) * currentCalibration[1];

    sumVabSq += Vab * Vab;
    sumVbcSq += Vbc * Vbc;
    sumIaSq += Ia * Ia;
    sumIcSq += Ic * Ic;

    sumW1 += Vab * Ia;
    sumW2 += Vbc * Ic;

    delayMicroseconds(sampleDelayMicros);
  }

  meter.Vab = sqrt(sumVabSq / numSamples);
  meter.Vbc = sqrt(sumVbcSq / numSamples);
  meter.Ia = sqrt(sumIaSq / numSamples);
  meter.Ic = sqrt(sumIcSq / numSamples);
  meter.W1 = sumW1 / numSamples;
  meter.W2 = sumW2 / numSamples;
  meter.totalPower = meter.W1 + meter.W2;

  return meter;
}

// ======================================
// FIREBASE UPLOAD
// ======================================
bool uploadRecord(TwoWattmeterData data) {
  String path = String("/readings/") + DEVICE_ID;
  Serial.print("Uploading... ");

  // Create JSON payload
  object_t root;
  root.init();
  root.set("timestamp", String((unsigned long)data.timestamp));
  root.set("Vab", String(data.Vab, 2));
  root.set("Vbc", String(data.Vbc, 2));
  root.set("Ia", String(data.Ia, 3));
  root.set("Ic", String(data.Ic, 3));
  root.set("W1", String(data.W1, 2));
  root.set("W2", String(data.W2, 2));
  root.set("totalPower", String(data.totalPower, 2));

  bool status = Database.push<object_t>(aClient, path.c_str(), root);

  if (status) {
    Serial.println("OK");
  } else {
    Serial.println("FAILED");
  }
  return status;
}

// ======================================
// LOCAL CACHING
// ======================================
void saveToCache(TwoWattmeterData data) {
  File file = LittleFS.open(CACHE_FILENAME, "ab");
  if (!file) {
    Serial.println("Failed to open cache for appending");
    return;
  }
  file.write((uint8_t*)&data, sizeof(TwoWattmeterData));
  file.close();
  Serial.println("Saved reading to local cache.");
}

int countCachedRecords() {
  File file = LittleFS.open(CACHE_FILENAME, "rb");
  if (!file) return 0;
  int count = file.size() / sizeof(TwoWattmeterData);
  file.close();
  return count;
}

void uploadCachedRecords() {
  int cachedCount = countCachedRecords();
  if (cachedCount <= 0) return;

  Serial.printf("Found %d cached records\n", cachedCount);

  File file = LittleFS.open(CACHE_FILENAME, "rb");
  File tempFile = LittleFS.open("/temp.bin", "wb");

  bool anyFailed = false;
  TwoWattmeterData buffer;
  int index = 0;
  time_t now;
  time(&now);

  while (file.available()) {
    app.loop();
    file.read((uint8_t*)&buffer, sizeof(TwoWattmeterData));

    // Repair invalid timestamps
    if (buffer.timestamp < 1700000000) {
      buffer.timestamp = now - ((cachedCount - index) * (uploadInterval / 1000));
    }

    if (!uploadRecord(buffer)) {
      tempFile.write((uint8_t*)&buffer, sizeof(TwoWattmeterData));
      anyFailed = true;
    }
    index++;
    delay(50);
  }

  file.close();
  tempFile.close();

  LittleFS.remove(CACHE_FILENAME);

  if (anyFailed) {
    LittleFS.rename("/temp.bin", CACHE_FILENAME);
  } else {
    LittleFS.remove("/temp.bin");
    Serial.println("Cached Upload Complete");
  }
}

// ======================================
// WIFI & TIME
// ======================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting WiFi");
  WiFi.setHostname(HOST_NAME);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    Serial.print(".");
    delay(300);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected");
    wifiConnected = true;
  } else {
    Serial.println("\nWiFi Failed");
    wifiConnected = false;
  }
}

bool isTimeValid() {
  time_t now;
  time(&now);
  return now > 1700000000;
}

// ======================================
// SETUP
// ======================================
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  delay(1000);

  Serial.println("\n================================");
  Serial.println("3-PHASE POWER MONITOR INITIALIZING");
  Serial.println("================================");

  // Mount FS
  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS Failed");
    return;
  }

  connectWiFi();

  // Initialize Firebase
  ssl.setInsecure();
  user_auth.user.email = USER_EMAIL;
  user_auth.user.password = USER_PASS;
  config.api_key = WEB_API_KEY;

  initializeApp(aClient, app, getAuth(user_auth), asyncCB, "authTask");
  app.getApp<RealtimeDatabase>(Database);
  Database.url(DATABASE_URL);

  // Initialize Time
  configTime(8 * 3600, 0, "asia.pool.ntp.org", "time.google.com");
  Serial.print("Waiting NTP");
  struct tm ti;
  for (int i = 0; i < 20; i++) {
    if (getLocalTime(&ti)) break;
    Serial.print(".");
    delay(500);
  }
  Serial.println(" Done\n");

  // Initial Offsets Check
  VabOffset = readOffset(VAB_PIN);
  VbcOffset = readOffset(VBC_PIN);
  IaOffset = readOffset(IA_PIN);
  IcOffset = readOffset(IC_PIN);
}

// ======================================
// MAIN LOOP
// ======================================
void loop() {
  app.loop();

  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    connectWiFi();
  }

  if (millis() - lastUpload >= uploadInterval) {
    lastUpload = millis();

    // NTP Time Validation
    if (!isTimeValid()) {
      Serial.println("Invalid Time. Waiting NTP...");
      struct tm ti;
      int retry = 0;
      while (!getLocalTime(&ti) && retry < 20) {
        Serial.print(".");
        delay(500);
        retry++;
      }
      Serial.println();
      if (!getLocalTime(&ti)) {
        Serial.println("NTP Sync Failed - Skipping Cycle");
        return;
      }
    }

    // Run measurement
    TwoWattmeterData meter = measureTwoWattmeter();
    time(&meter.timestamp);

    // Output to Serial
    Serial.println("\n==============================");
    Serial.println("WATTMETER 1");
    Serial.printf("Vab RMS: %.2f V\n", meter.Vab);
    Serial.printf("Ia RMS: %.3f A\n", meter.Ia);
    Serial.printf("W1: %.2f W\n", meter.W1);
    Serial.println("---------------------");
    Serial.println("WATTMETER 2");
    Serial.printf("Vbc RMS: %.2f V\n", meter.Vbc);
    Serial.printf("Ic RMS: %.3f A\n", meter.Ic);
    Serial.printf("W2: %.2f W\n", meter.W2);
    Serial.println("---------------------");
    Serial.printf("TOTAL POWER: %.2f W\n", meter.totalPower);
    Serial.println("==============================\n");

    // Firebase Auth Wait & Upload
    if (wifiConnected) {
      uint32_t timer = millis();
      while (!app.ready() && millis() - timer < 15000) {
        app.loop();
        delay(10);
      }
    }

    bool uploadSuccess = false;
    if (wifiConnected && app.ready()) {
      uploadCachedRecords();
      app.loop();
      uploadSuccess = uploadRecord(meter);
    }

    // Fallback to cache if failed
    if (!uploadSuccess) {
      saveToCache(meter);
    }
  }
}