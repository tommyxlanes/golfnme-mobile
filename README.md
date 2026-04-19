# GolfnMe Mobile (Expo / React Native)

## Stack
- **Expo SDK 52** with Expo Router (file-based navigation)
- **React Native** — iOS + Android from one codebase
- **Zustand** — auth + app state
- **TanStack Query** — data fetching + caching
- **NativeWind** — Tailwind-style utilities (optional)
- Points at your existing **Next.js backend** on Hetzner

---

## Quick Start

### 1. Install dependencies
```bash
cd golfnme-mobile
npm install
```

### 2. Install Expo Go on your phone
- iOS: App Store → "Expo Go"
- Android: Play Store → "Expo Go"

### 3. Configure API URL
Edit `lib/api.ts`:
```ts
export const API_BASE = __DEV__
  ? "http://YOUR_LOCAL_IP:3000"   // e.g. http://192.168.1.42:3000
  : "https://app.golfnme.com";    // production
```
Use your machine's local IP (not localhost) so your phone can reach it.

### 4. Add backend mobile auth routes to your Next.js app
Copy these files into your Next.js project:

```
backend/mobile-login-route.ts  →  src/app/api/auth/mobile/login/route.ts
backend/mobile-me-route.ts     →  src/app/api/auth/mobile/me/route.ts (GET)
                                   src/app/api/auth/mobile/logout/route.ts (POST)
backend/mobile-auth.ts         →  src/lib/mobile-auth.ts
```

Install jose in your Next.js project:
```bash
npm install jose
```

### 5. Start dev server
```bash
npx expo start
```
Scan the QR code with Expo Go on your phone.

---

## Project Structure

```
golfnme-mobile/
├── app/
│   ├── _layout.tsx          # Root layout + auth guard
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx        # Login screen
│   │   └── signup.tsx       # Signup screen (TODO)
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab bar
│   │   ├── index.tsx        # Play tab (dashboard)
│   │   ├── rounds.tsx       # Round history (TODO)
│   │   ├── stats.tsx        # Stats (TODO)
│   │   ├── friends.tsx      # Friends (TODO)
│   │   └── profile.tsx      # Profile (TODO)
│   ├── round/
│   │   ├── [id].tsx         # Active round scorecard ✅
│   │   └── new.tsx          # Start new round (TODO)
│   ├── session/
│   │   ├── [code].tsx       # Active group session (TODO)
│   │   ├── new.tsx          # Create session (TODO)
│   │   └── join.tsx         # Join session (TODO)
│   └── courses/
│       └── index.tsx        # Browse courses (TODO)
├── lib/
│   └── api.ts               # All API calls ✅
├── stores/
│   └── authStore.ts         # Auth state ✅
├── backend/                 # Files to copy into Next.js
│   ├── mobile-login-route.ts
│   ├── mobile-me-route.ts
│   └── mobile-auth.ts
├── app.json                 # Expo config
└── eas.json                 # EAS Build config
```

---

## Building for Production

### Setup EAS
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Build (cloud — no Mac needed)
```bash
# Both platforms
eas build --platform all

# Android only (faster for testing)
eas build --platform android
```

### Submit to stores
```bash
eas submit --platform ios
eas submit --platform android
```

### OTA update (no store review)
```bash
eas update --branch production --message "Fix score entry bug"
```

---

## What's Built vs TODO

### ✅ Done
- Auth store (login/logout/session persistence via SecureStore)
- API client (all endpoints typed and wired)
- Play tab dashboard (start round, sessions, quick actions)
- Active round screen (hole nav, strokes, putts, save score, edit hole modal)
- Root layout with auth guard
- Tab navigator

### TODO (next screens to build)
- `(auth)/signup.tsx` — sign up form
- `round/new.tsx` — course picker + start round
- `session/[code].tsx` — group session with leaderboard + chat
- `(tabs)/rounds.tsx` — round history list
- `(tabs)/stats.tsx` — performance stats
- `(tabs)/friends.tsx` — friends + requests
- `(tabs)/profile.tsx` — profile edit + avatar
- `courses/index.tsx` — browse + add courses
- Live GPS map (react-native-maps)
- Push notifications (expo-notifications)

---

## Key Decisions

**JWT for mobile auth** — NextAuth uses cookies which don't work cleanly in React Native.
The mobile login endpoint (`/api/auth/mobile/login`) returns a JWT stored in SecureStore.
All API requests include `Authorization: Bearer <token>`.
Your existing web app continues to use NextAuth cookies unchanged.

**Same backend** — Zero changes to your Prisma schema, services, or worker.
The Expo app just calls the same API routes your web app uses.

**Ably for real-time** — Ably's JS SDK works in React Native.
Session leaderboard updates work the same way as on web.
