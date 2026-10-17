# Vetted

Vetted is a React + TypeScript dating app prototype using Firebase for authentication and, as the app grows, its backend services.

## Run the web app

Local app URL: <http://127.0.0.1:5173/>

1. Create a Firebase project and register a Web app in the Firebase console.
2. Copy `web/.env.example` to `web/.env` and paste in the Web app configuration. These `VITE_` values are public client configuration; never put private keys or provider secrets in this file.
3. In Firebase Authentication, enable the Email/Password provider.
4. From `web/`, run `npm install` and `npm run dev`.

The app currently supports email/password account creation and sign-in. Firestore and Storage rules deny all access until collection schemas and authorization rules are implemented.

## Use the local emulators

Install the Firebase CLI and Java 11 or later. Copy `firebase/.firebaserc.example` to `.firebaserc`, set `VITE_FIREBASE_PROJECT_ID=demo-vetted` in `web/.env`, and provide local placeholder values for the other Firebase config fields. Then set `VITE_USE_FIREBASE_EMULATORS=true` in `web/.env`.

From the repository root, start the emulators:

```sh
firebase emulators:start --only auth,firestore,storage
```

In a second terminal, run the Vite app from `web/` with `npm run dev`. The web SDK will connect to local emulators only in development mode when the opt-in variable is set. Keep that variable off for a live Firebase project.

## Deploy Hosting

Install and sign in to the Firebase CLI, then select a Firebase project with `firebase use --add`. Build the web app and deploy Hosting:

```sh
cd web && npm run build
cd .. && firebase deploy --only hosting
```

Firestore and Storage are locked by the starter rules. Do not deploy production data features until rules are designed for the corresponding collections and upload paths.
