# SCOT Live Schedule — Standalone Mobile App (PWA)

A dedicated, read-only mobile application for viewing the **SCOT Classroom Gantt Chart**, **Schedule Table / Staff Cards**, and **Equipment List**, downloading **PDF & Excel (.xlsx)** sheets, and receiving **real-time booking notifications** — powered exclusively by a scoped **Gantt API Key** without exposing the internal employee portal.

---

## 1. Generate Your API Key in the Main Portal
1. Sign in to the main SCOT Portal as an Admin and open **Admin Panel** (`/admin`).
2. Click **Gantt API Key** → **Generate API Key**.
3. Copy the **API Key** (`scot_gantt_...`) and the **Portal Server URL** (e.g., `https://your-portal.vercel.app` or `http://localhost:3001`).

*(Optional fallback: you can also set `GANTT_PUBLIC_API_KEY` in the main portal's `.env` / Vercel Environment Variables.)*

---

## 2. Run Locally
```bash
cd gantt-mobile-app
npm install
npm run dev
```
Open `http://localhost:5174` on your browser or phone (same Wi-Fi) and paste the Portal Server URL + API Key.

### Zero-Login Pre-Configuration (Optional)
Create `gantt-mobile-app/.env.local` if you want devices to connect automatically without typing the key:
```env
VITE_PORTAL_API_URL=https://your-portal.vercel.app
VITE_GANTT_API_KEY=scot_gantt_...
```

---

## 3. Deploy as a Separate Mobile App (Vercel)
1. Deploy the `gantt-mobile-app/` directory as its own Vercel project (completely separate domain from your internal employee portal).
2. Staff open the URL on Android (Chrome) or iOS (Safari) and tap **Add to Home Screen** — it installs like a native mobile app with real-time notifications.

---

## 4. API Endpoints Consumed (Read-Only)
All requests require `x-api-key: <KEY>` (or `?key=<KEY>` for SSE):
- `GET /api/gantt/verify` — Validate key & fetch building/room list
- `GET /api/gantt/schedule` — Active classroom & equipment schedule snapshot
- `GET /api/gantt/equipment` — Active equipment reservations
- `GET /api/gantt/stream` — Real-time Server-Sent Events (SSE) push stream with automatic polling fallback
