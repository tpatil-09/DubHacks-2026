# SafeMatch

SafeMatch is a dating app built with React, TypeScript, and Vite. Firebase Authentication, Cloud Firestore, Storage, and Hosting power the site. Profiles, preferences, likes, matches, messages, games, blocks, and reports are stored in Firestore. Each profile can also show a background-check report from the `background_check/` pipeline with source links, uncertainty, and a human-review boundary. The compatibility quiz, Would You Rather capsules, and safety controls help people get to know and protect themselves.

## Run the web app

Local app URL: <http://localhost:5173/> (use `localhost`, not `127.0.0.1`: Firebase sign-in only allows `localhost` by default)

From `web/`, run `npm install`, then `npm run env:firebase` once, then `npm run dev`.

`npm run env:firebase` writes the project's public Firebase web config into `web/.env` (it reads it from the deployed site, `https://dubhacks-2026.web.app/__/firebase/init.json`). Without it, `web/.env` doesn't exist and the app silently falls back to demo mode, so sign-in won't work locally.

### Demo mode (no Firebase needed)

If `web/.env` has no Firebase config, or `VITE_DEMO_MODE=true`, the app runs in demo mode. Click **Try demo mode** on the sign-in screen. Everything is stored in this browser's localStorage and uses fictional demo profiles (marked with a 🧪 Demo tag) that like you back, reply in chat, and answer game capsules. In demo mode every demo profile has a pre-built, clearly labeled synthetic background check (`web/src/fixtures/demoReports.ts`, `example.com` sources) covering each result tier.

To reset demo data, sign out and clear the site's localStorage.

### Firebase mode

1. Create a Firebase project and register a Web app in the Firebase console.
2. Copy `web/.env.example` to `web/.env` and paste in the Web app configuration. These `VITE_` values are public client configuration; never put database credentials or provider secrets in this file.
3. In Firebase Authentication, enable the Google and Email/Password providers. Create the Cloud Firestore database in `us-west1` and enable Storage if photo uploads are needed.
4. Deploy Firestore rules/indexes and Hosting with `firebase deploy --only firestore:rules,firestore:indexes,hosting`. The frontend talks directly to Firestore using the Firebase Web SDK; Authentication and Firestore Security Rules restrict reads and writes. No server function or database password is required for core profile and matching flows.
5. For local development, set `VITE_USE_FIREBASE_EMULATORS=true` in `web/.env` and start Auth, Firestore, and Storage emulators.

Firestore uses purpose-specific collections: `users/{uid}` for private account settings, `profiles/{uid}` for discoverable profile data, `preferences/{uid}` for private match preferences, and separate collections for likes, matches, game answers, blocks, and reports. Match messages are a subcollection of each match. Firestore rules limit profile edits to their owner, keep preferences private, restrict matches/messages to participants, and require mutual likes before a match can be created. Firebase Auth owns credentials; photos stay in Firebase Storage; background-check reports stay in restricted Firestore documents. The previous Atlas integration is no longer used by the website. The existing 36 synthetic profiles and five new Seattle profiles have been seeded into `profiles` as clearly labeled demo records; they are not Firebase sign-in accounts.

During onboarding, users enter a self-reported age (18+) and a city or region. The profile stores the age only; it does not collect a birthdate or precise location. Signed-in users load discoverable profiles from Firestore. Profile edits, private preferences, and social actions save directly to Firestore under restrictive security rules. Optional pronouns, relationship intentions, and an age range help users describe what they want without collecting precise location.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | Public Firebase web config |
| `VITE_USE_FIREBASE_EMULATORS` | `true` connects to local emulators (dev only) |
| `VITE_DEMO_MODE` | `true` forces demo mode even when Firebase is configured |

Background checks are read from `screenings/{uid}`. The screening Cloud Function writes that document: it runs the `background_check` pipeline after the member consents during onboarding and stores its `report.json`. Any signed-in member can read it, but only Functions can write it. Until a member's check exists, their profile shows "Background check in progress". The UI shows only findings linked to the person; name-only matches appear as a count.

### GoDaddy domain

The MLH GoDaddy Registry prize is a domain registration, not web hosting. Keep Firebase Hosting for the frontend and connect the registered domain in Firebase Console → Hosting → Add custom domain. Firebase will show the DNS records for that exact domain; add those records in the GoDaddy DNS manager, then wait for domain verification and HTTPS provisioning.

## Checks

From `web/`:

```sh
npm run typecheck
npm test
npm run build
```

## Use the local emulators

Install the Firebase CLI and Java 11 or later. Set `VITE_FIREBASE_PROJECT_ID=demo-vetted` in `web/.env`, and provide local placeholder values for the other Firebase config fields. Then set `VITE_USE_FIREBASE_EMULATORS=true` in `web/.env`.

From the repository root, start the emulators:

```sh
firebase emulators:start --only auth,firestore,storage,functions --project demo-vetted
```

In a second terminal, run the Vite app from `web/` with `npm run dev`. The web SDK will connect to local emulators only in development mode when the opt-in variable is set. Keep that variable off for a live Firebase project.

To seed 36 synthetic Firestore profiles in the local emulator, run this from the repository root while the Firestore emulator is running:

```sh
node scripts/seed-demo-users.mjs
```

The script only connects to `127.0.0.1:8080` and refuses Firebase project IDs that do not begin with `demo-`. These are demo profile documents, not authentication accounts, and are never added to production.

### Seed the shared Firebase project's synthetic profiles

The production seeder copies the existing 36 `demoProfiles` records into the app's `profiles` collection and upserts five new Seattle profiles. It also creates private preferences documents; it does not create sign-in accounts. Run it from Google Cloud Shell or another environment authenticated with Application Default Credentials for the Firebase project owner:

```sh
cd scripts/firestore-seed
npm install
FIREBASE_PROJECT_ID=dubhacks-2026 npm run seed
```

The script is explicitly limited to the `dubhacks-2026` project and only writes fictional demo records.

### Legacy SQL Connect experiment

The repository retains a Firebase SQL Connect schema from an earlier prototype. The current website does not read or write that database; operational profiles and matching data use Cloud Firestore. Local SQL Connect emulator data lives under `.firebase/dataconnect-data` and is separate from Firestore.

Start the Auth and SQL Connect emulators with a demo project ID:

```sh
firebase emulators:start --only auth,dataconnect --project demo-vetted --import .firebase/demo-emulators --export-on-exit .firebase/demo-emulators
```

For the first seed, leave off `--import .firebase/demo-emulators` if that folder does not exist. In another terminal, run:

```sh
node scripts/seed-demo-data.mjs
```

This legacy script upserts synthetic fixtures to the local SQL Connect emulator and creates Auth Emulator accounts. The SQL Connect hosted project is not modified by this seed command.

## Deploy

Install and sign in to the Firebase CLI, then select a Firebase project with `firebase use --add`. Build the web app and deploy Hosting, Firestore rules/indexes, and Storage rules:

```sh
cd web && npm run build
cd .. && firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

`firebase/firestore.rules` restricts account/profile/social reads and writes by owner and match membership. `firebase/storage.rules` limits profile photo uploads to the owner, images only, under 2 MB.
