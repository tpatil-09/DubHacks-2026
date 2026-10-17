# Vetted

Vetted is a cozy pastel arcade dating app prototype: collectible profile cards, a compatibility quiz, Would You Rather capsules in chat, and optional private safety reports. It is built with React + TypeScript + Vite and runs 100% on Firebase (Hosting, Auth, Firestore, Storage, Cloud Functions).

## Run the web app

Local app URL: <http://127.0.0.1:5173/>

From `web/`, run `npm install` and `npm run dev`.

### Demo mode (no Firebase needed)

If `web/.env` has no Firebase config, or `VITE_DEMO_MODE=true`, the app runs in demo mode. Click **Try demo mode** on the sign-in screen. Everything is stored in this browser's localStorage and uses fictional demo profiles (marked with a 🧪 Demo tag) that like you back, reply in chat, and answer game capsules. Safety reports in demo mode use clearly labeled synthetic fixtures with `example.com` sources; names that aren't demo profiles always return "live search is not available in demo mode".

To reset demo data, sign out and clear the site's localStorage.

### Firebase mode

1. Create a Firebase project and register a Web app in the Firebase console.
2. Copy `web/.env.example` to `web/.env` and paste in the Web app configuration. These `VITE_` values are public client configuration; never put private keys or provider secrets in this file.
3. In Firebase Authentication, enable the Google and Email/Password providers, and add your Hosting domain to Authorized domains.
4. Create a Firestore database and a Storage bucket, then deploy the rules (see below).

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | Public Firebase web config |
| `VITE_USE_FIREBASE_EMULATORS` | `true` connects to local emulators (dev only) |
| `VITE_DEMO_MODE` | `true` forces demo mode even when Firebase is configured |

Safety reports call the `requestSafetyReport` and `getSafetyReport` Cloud Functions owned by the screening team. Until those are deployed, the request screen shows a friendly "service isn't available yet" error in Firebase mode. Report status is read from `reportRequests/{id}`, which only the requester can read and only Functions can write.

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

## Deploy

Install and sign in to the Firebase CLI, then select a Firebase project with `firebase use --add`. Build the web app and deploy Hosting and rules:

```sh
cd web && npm run build
cd .. && firebase deploy --only hosting,firestore:rules,storage
```

`firebase/firestore.rules` lets users write only their own account, profile, likes, quiz, and answers; only allows a match when both players have liked each other; limits chat to match participants; and keeps safety reports private to the requester. `firebase/storage.rules` limits profile photo uploads to the owner, images only, under 2 MB.
