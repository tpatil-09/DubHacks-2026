# SafeMatch

SafeMatch is a dating app prototype where every profile comes with a background check, so people can relax and have fun dating. Use it like a regular swipe-and-chat dating app, or play optional games (a compatibility quiz and Would You Rather capsules) for a fun match. Each member's public-records check comes from the `background_check/` pipeline and appears on their profile, color coded by result, with a TLDR, verified and unresolved findings, and links to the sources. It is built with React + TypeScript + Vite and runs 100% on Firebase (Hosting, Auth, Firestore, Storage, Cloud Functions).

## Run the web app

Local app URL: <http://127.0.0.1:5173/>

From `web/`, run `npm install` and `npm run dev`.

### Demo mode (no Firebase needed)

If `web/.env` has no Firebase config, or `VITE_DEMO_MODE=true`, the app runs in demo mode. Click **Try demo mode** on the sign-in screen. Everything is stored in this browser's localStorage and uses fictional demo profiles (marked with a 🧪 Demo tag) that like you back, reply in chat, and answer game capsules. In demo mode every demo profile has a pre-built, clearly labeled synthetic background check (`web/src/fixtures/demoReports.ts`, `example.com` sources) covering each result tier.

To reset demo data, sign out and clear the site's localStorage.

### Firebase mode

1. Create a Firebase project and register a Web app in the Firebase console.
2. Copy `web/.env.example` to `web/.env` and paste in the Web app configuration. These `VITE_` values are public client configuration; never put private keys or provider secrets in this file.
3. In Firebase Authentication, enable the Google and Email/Password providers, and add your Hosting domain to Authorized domains.
4. Create a Firestore database and a Storage bucket, then deploy the rules (see below).

During onboarding, users enter a self-reported age (18+) and a city or region. The profile stores the age only; it does not collect a birthdate or precise location. Firestore lets signed-in users discover profiles, while only each profile owner can change their profile.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | Public Firebase web config |
| `VITE_USE_FIREBASE_EMULATORS` | `true` connects to local emulators (dev only) |
| `VITE_DEMO_MODE` | `true` forces demo mode even when Firebase is configured |

Background checks are read from `screenings/{uid}`. The screening Cloud Function writes that document: it runs the `background_check` pipeline after the member consents during onboarding and stores its `report.json`. Any signed-in member can read it, but only Functions can write it. Until a member's check exists, their profile shows "Background check in progress". The UI shows only findings linked to the person; name-only matches appear as a count.

## Checks

From `web/`:

```sh
npm run typecheck
npm test
npm run build
```

## Use the local emulators

Install the Firebase CLI and Java 11 or later. Copy `firebase/.firebaserc.example` to `.firebaserc`, set `VITE_FIREBASE_PROJECT_ID=demo-vetted` in `web/.env`, and provide local placeholder values for the other Firebase config fields. Then set `VITE_USE_FIREBASE_EMULATORS=true` in `web/.env`.

From the repository root, start the emulators:

```sh
firebase emulators:start --only auth,firestore,storage
```

In a second terminal, run the Vite app from `web/` with `npm run dev`. The web SDK will connect to local emulators only in development mode when the opt-in variable is set. Keep that variable off for a live Firebase project.

To seed 36 synthetic Firestore profiles in the local emulator, run this from the repository root while the Firestore emulator is running:

```sh
node scripts/seed-demo-users.mjs
```

The script only connects to `127.0.0.1:8080` and refuses Firebase project IDs that do not begin with `demo-`. These are demo profile documents, not authentication accounts, and are never added to production.

## Deploy

Install and sign in to the Firebase CLI, then select a Firebase project with `firebase use --add`. Build the web app and deploy Hosting and rules:

```sh
cd web && npm run build
cd .. && firebase deploy --only hosting,firestore:rules,storage
```

`firebase/firestore.rules` lets users write only their own account, profile, likes, quiz, and answers; only allows a match when both players have liked each other; limits chat to match participants; and keeps safety reports private to the requester. `firebase/storage.rules` limits profile photo uploads to the owner, images only, under 2 MB.
