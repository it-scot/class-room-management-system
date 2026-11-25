# SCOT Live Schedule — React Native (Expo) Mobile App

A dedicated, zero-login React Native mobile application powered solely by the scoped **Gantt API Key** from the SCOT Facility Management System Admin Panel.

## Features
- **No Login / No Signup** — opens straight into the live classroom schedule.
- **Horizontal Gantt Timeline** — 08:00–18:00 room timeline with live pulsing `NOW` line, Building 1 / Building 2 filters, and `Booked Only / All Rooms` toggle.
- **Table & Staff Cards View** — structured schedule table and mobile cards with search, live status (`LIVE NOW`, `IN Xm`, `UPCOMING`), and persistent **Opened / Mark Ready** checklist.
- **Equipment List & Checklist** — view daily or upcoming equipment bookings with quantity summaries and **Issued / Mark Ready** toggles.
- **PDF & Excel (`.xlsx`) Downloads** — native `expo-print` / `expo-sharing` on Android & iOS, plus instant file downloads on web.
- **Real-Time Sync & Notifications** — SSE stream + automatic 10s polling fallback with native/OS notifications and alert feed.

## Connect to Live Portal
1. In the main portal's **Admin Panel** (`/admin`), click **Gantt API Key** → **Generate API Key**.
2. Set `EXPO_PUBLIC_PORTAL_API_URL` and `EXPO_PUBLIC_GANTT_API_KEY` in `gantt-mobile-app/.env`, **or** tap the **Settings (gear)** icon in the mobile app header to paste your URL & API key directly.

## Run Locally
```bash
cd gantt-mobile-app
npm install
npm run web      # Local mobile preview in browser (http://localhost:8081)
npm run android  # Run on Android emulator / Expo Go
npm run ios      # Run on iOS simulator / Expo Go
```
