# 📱 CIRO Mobile — Installable APK Setup & Execution Guide

This is the official mobile application for the **CIRO (Crisis Intelligence & Response Orchestrator)** platform. It enables field responders to receive real-time admin dispatches, execute routes with GPS navigation synchronizations, and civilians to broadcast SOS distress beacons and track responder vehicles.

---

## 🛠️ 1. Quick Local Start (Test on Phone in 60s)

To test the application instantly on your physical Android or iOS device using **Expo Go**:

1.  **Open the mobile directory in your terminal**:
    ```powershell
    cd mobile
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Launch the Expo Developer server**:
    ```bash
    npm run start
    ```
4.  **Open on your phone**:
    *   Download **Expo Go** from the Google Play Store (Android) or iOS App Store.
    *   Scan the QR code shown in your terminal with your phone.
    *   The app will compile and run natively on your device with hot-reloading!

---

## 🧭 2. Core Operational Modules

### 🚨 Module A: Civilian distress beacon
*   **SOS 1-Tap Beacon**: Hold down the central red SOS button for 2 seconds to immediately broadcast a high-priority distress pin at your GPS coordinates, triggering a critical alert on the Next.js Admin Command Center.
*   **Encrypted Dispatch Report**: Complete rich incident forms (category emojis, severity levels, description logs, and automatic GPS lock) to report emergencies directly to the Supabase persistence layer.
*   **Offline Incident Queue**: If mobile data is disconnected, the app stores submissions securely in device memory. It automatically syncs them the moment a connection is re-established.

### ⏱️ Module B: Live Responder Tracker ("See if Help is Coming")
*   Select any active distress report to audit response progress.
*   **Dynamic Response Stepper**: View real-time milestone transitions (`Distress Signal Sent` ➔ `AI Approval` ➔ `Responders Dispatched` ➔ `On Scene`).
*   **Dispatched Telemetry Map**: Displays dispatched responders (e.g. 🚑 AMB_1) moving toward your beacon on the map in real time.

### 🗺️ Module C: Field Responder Operations HUD ("Navigation from Admin")
*   Go to **Settings** and toggle **Responder HUD Tunnels** to reveal the responder tab.
*   Select your vehicle asset (e.g., `AMBULANCE_1`).
*   **Incoming Active Assignments**: Displays critical incidents assigned to your vehicle from the Next.js Admin Panel.
*   **Interactive Turn-by-Turn Routing**: Calibrates and draws route directions to the target sector.
*   **Sync Telemetry**: Clicking **Start Route Navigation** simulates driving coordinates and updates them directly in Supabase. Civilians and the Admin command center will see your asset driving toward the target in real time!
*   **Status Triggers**: Easily mark milestones (`En Route`, `On Scene`, `Resolve / Re-engage`).

---

## 📦 3. Compiling the Standalone APK

EAS Build (Expo Application Services) packages native binaries, compiles Java source code, and outputs a downloadable `.apk` file ready to be copied and installed on any Android phone.

### Prerequisites:
1. Create a free account at [expo.dev](https://expo.dev).
2. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
3. Log in to your Expo account:
   ```bash
   eas login
   ```

### Step 1: Initialize EAS configuration
Run inside the `mobile` folder:
```bash
eas build:configure
```
*When prompted, select `Android` or `All`.*

### Step 2: Configure to output an installable `.apk`
Open the newly created `eas.json` file in the `mobile` directory, and modify the `preview` profile under `build` to generate an `.apk` file instead of an app bundle:
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

### Step 3: Run the build
Execute the cloud compile script:
```bash
eas build -p android --profile preview
```

### Step 4: Download and Install
*   EAS will compile the native Android bundle in the cloud.
*   Once finished, a **QR Code and Download Link** for the `.apk` will print directly in your terminal.
*   Scan the QR code with your phone or click the link to download the `.apk` file.
*   Transfer it to your phone and install it (enable "Install from Unknown Sources" if prompted).
*   **Your custom CIRO Mobile App is now installed natively on your phone!**
