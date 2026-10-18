# DubHacks 2026 — Firebase-first dating app plan

> Working name: **Vetted** (placeholder)

A dating web app with profiles, opt-in safety tools, realtime chat, and mini-games for getting to know a match. The web client is React + TypeScript + Vite; Firebase provides the application backend and hosting.

## 1. Product and safety boundary

Build the dating experience around user-controlled profiles, matching, blocking/reporting, and optional identity or age verification. The product may use AI to prepare a private, evidence-linked safety report from lawfully obtained conviction-record data for a trained human reviewer. AI output is a research aid, not a finding of identity, guilt, risk, or eligibility: it must not automatically exclude, label, or rank a person.

Do not use facial recognition, face embeddings, reverse-image search, or automated comparison of profile photos against booking photos or criminal-record databases to identify a person. A similar name, photograph, or other single attribute is not reliable proof of identity. Any report must show its sources, dates, record status, and identity-match basis; a trained reviewer must independently verify the underlying records and identity, document their decision, and provide a correction/dispute path before any account action. Uncertain or conflicting matches must be marked inconclusive, not treated as confirmed.

Before collecting or processing sensitive data, obtain qualified legal/privacy review for the jurisdictions and data sources involved, including consent and notice, permitted registry use, data minimization, retention, security, and applicable consumer-reporting requirements. Use only lawfully accessible, authoritative sources and follow their terms. Keep reports private, restrict reviewer access, retain them only as long as justified, and support correction and appeal. For identity or age verification, use a consent-based, appropriately vetted provider and retain the minimum result needed. Firebase is infrastructure; it does not supply or validate criminal-record data.

For immediate product safety, prioritize blocking, reporting, account controls, moderation queues, safe meet-up guidance, and optional trusted-contact/date check-ins. Reports and moderation decisions should have human review, access controls, audit history, and an appeal path.

## 2. Firebase-first architecture

```text
React + TypeScript + Vite
        │ Firebase Web SDK (public app configuration; never secret credentials)
        ├── Firebase Authentication      sign-in and session
        ├── Cloud Firestore               profiles, matches, chat, games, reports
        ├── Cloud Storage                 profile photos and game media
        ├── Cloud Functions               trusted writes, moderation, notifications
        ├── Firebase Genkit + Vertex AI   server-side, evidence-grounded report drafting
        ├── Firebase App Check            reduce abuse from unauthorized clients
        ├── Firebase Hosting              SPA hosting, HTTPS, preview channels
        ├── Firebase Analytics            privacy-conscious product metrics
        ├── Remote Config                 gradual feature switches
        ├── Cloud Messaging                optional web push notifications
        └── Performance Monitoring         web performance measurements

Local development and tests:
Firebase Emulator Suite (Auth, Firestore, Storage, Functions, Hosting)

External integrations, only when needed:
Functions + Secret Manager for approved record-source/provider credentials;
never expose credentials in the Vite bundle or client-side environment variables.
```

Use Firebase as the default backend rather than adding a separate API server or database. Keep game rules and security-critical decisions on Functions, not in the browser. Do not add a Firebase product just to check a box; each enabled service needs a clear user-facing purpose and privacy setting.

## 3. Stack

| Area | Choice | Role |
|---|---|---|
| Frontend | React, TypeScript, Vite | Single-page web app and static build |
| Routing | React Router | Client-side routes; Firebase Hosting rewrites app routes to `index.html` |
| Styling | Tailwind CSS and Framer Motion (optional) | UI and animation |
| Client SDK | Firebase JavaScript SDK, modular APIs | Auth, Firestore, Storage, Functions, Analytics, App Check |
| Sign-in | Firebase Authentication | Google and/or email sign-in; enable only providers the app supports |
| Database | Cloud Firestore | User data, profiles, matches, messages, game state, reports |
| Media | Cloud Storage for Firebase | Profile photos and user-generated game media |
| Backend | Cloud Functions for Firebase, TypeScript | Trusted mutations, triggers, moderation workflows, push notifications |
| AI reports | Firebase Genkit in Functions with Vertex AI | Draft structured summaries from retrieved evidence; no identity determination or automated eligibility decision |
| Hosting | Firebase Hosting | HTTPS delivery, SPA rewrites, preview channels |
| Abuse protection | Firebase App Check | App attestation / reCAPTCHA provider for supported web flows |
| Local testing | Firebase Emulator Suite | Rules, functions, auth, storage, and integration tests |
| Observability | Analytics + Performance Monitoring; Functions logs | Aggregated product metrics and operational diagnostics |
| Optional configuration | Remote Config | Gradual rollout and non-sensitive feature flags |
| Optional notifications | Firebase Cloud Messaging | Opt-in web push for messages and match activity |

Check the current supported Node.js runtime when setting up Functions. Cloud Functions and some other services may require the Firebase Blaze plan and a billing account; check current pricing, quotas, and budget alerts before enabling them.

## 4. Repository layout

```text
DubHacks-2026/
├── web/                           # React + TypeScript + Vite app
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   ├── .env.example               # public Firebase web config only
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/
│       │   ├── firebase.ts        # initialize SDKs once
│       │   └── analytics.ts       # consent-aware, non-PII events
│       ├── routes/
│       │   ├── Landing.tsx
│       │   ├── Login.tsx
│       │   ├── onboarding/
│       │   ├── Discover.tsx
│       │   ├── Matches.tsx
│       │   ├── Chat.tsx
│       │   ├── Profile.tsx
│       │   ├── Safety.tsx
│       │   └── games/
│       ├── components/
│       │   ├── layout/            # auth and verified-state route guards
│       │   └── ui/
│       ├── hooks/                 # auth, profile, chat, matches, game sessions
│       ├── games/                 # testable game logic
│       └── types/                 # application data types
├── functions/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── accounts/              # account lifecycle and trusted profile fields
│       ├── matching/              # likes and mutual-match creation
│       ├── moderation/            # user reports and content review workflow
│       ├── safetyReports/          # source retrieval, AI draft, human review, appeals
│       ├── games/                 # validate competitive moves
│       └── notifications/         # opt-in FCM notifications
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
├── firebase.json                 # emulators, hosting, rules, functions config
├── .firebaserc
└── .github/workflows/
    └── deploy.yml                # test/build and deploy Firebase resources
```

## 5. Data model (initial version)

Keep documents small, avoid duplicating sensitive fields, and use Firestore subcollections for unbounded data such as messages. Never put private reports, identity documents, access tokens, or provider secrets in public profile documents.

### `users/{uid}` — private account and application state

```ts
{
  uid: string,
  email: string,
  createdAt: Timestamp,
  onboardingStep: "basic" | "profile" | "complete",
  accountStatus: "active" | "restricted" | "closed", // trusted writes only
  ageVerificationStatus?: "not_started" | "pending" | "verified", // trusted writes only
  settings: { notifications: boolean, discoverable: boolean }
}
```

### `profiles/{uid}` — discoverable profile

```ts
{
  uid: string,
  displayName: string,
  birthdate: Timestamp, // restrict reads; consider storing only the minimum age data
  bio: string,
  prompts: { question: string, answer: string }[],
  photoPaths: string[], // Storage paths, not public download URLs
  interests: string[],
  updatedAt: Timestamp
}
```

### Other collections

- `likes/{fromUid_toUid}`: one user's like/pass for another; client can create only their own valid action.
- `matches/{matchId}`: sorted participant UIDs and timestamps; create through a trusted Function after mutual likes.
- `matches/{matchId}/messages/{messageId}`: sender, bounded text, type, timestamp; participants only.
- `gameSessions/{sessionId}`: game type, participant UIDs, status, state, turn and timestamps; Functions validate competitive moves.
- `reports/{reportId}`: reporter, reported user, reason, optional details, status and timestamps; visible only to the reporter for their submission status and authorized moderators for handling.
- `blocks/{uid}/blocked/{otherUid}`: block relationship; use it to filter discovery and prevent contact.
- `moderationCases/{caseId}`: restricted, moderator-only workflow records; do not use automated face or criminal-record matching to decide case outcomes.
- `safetyReports/{reportId}`: restricted report package with subject UID, source references, retrieval timestamps, record-status metadata, identity-match basis, AI-generated summary, uncertainty/limitations, reviewer decision, appeal status, and audit timestamps. Never expose this collection to dating-app users or use the AI summary alone to change account status.
- `safetyReports/{reportId}/evidence/{evidenceId}`: minimal normalized evidence and source metadata needed for reviewer verification; avoid storing raw identity documents or unnecessary copies of source records.
- `users/{uid}/devices/{deviceId}`: optional FCM token with user-scoped access and token cleanup.

Use server timestamps. Validate all client-writable fields in Firestore rules and Functions. Add composite indexes only when a real query requires them.

## 6. Security and privacy rules

Security rules are part of the product, not a later hardening step. Start restrictive and test rules in the Emulator Suite before connecting a production project.

- **Authentication:** require signed-in users for private operations. Enforce age eligibility through a suitable, reviewed process; do not rely on a date typed by the user as proof.
- **Firestore:** users can read/write only their own permitted account fields; users cannot change account status, moderator roles, or verification outcomes. Profiles are readable only by eligible signed-in users, and writes are owner-scoped and field-validated.
- **Matches and messages:** only match participants may read the match and its messages. Validate message size/type and sender UID. Use Functions for match creation, moderation state, and trusted mutations.
- **Reports and moderation:** users can submit reports and block other users; only authorized moderators can read/report-manage restricted case details. Record moderator actions and provide a review/appeal workflow.
- **AI-assisted safety reports:** only trusted Functions may retrieve approved sources and create report drafts. Require a reviewer role for report access; log access and decisions. The report must distinguish verified source facts from AI-generated summaries, include citations and retrieval dates, surface missing/conflicting data, and prohibit the model from inferring identity from photos or making eligibility decisions.
- **Storage:** use per-user paths; restrict content type and file size; prevent users from reading other users' private uploads. Profile-photo reads must follow the app's access policy. Avoid persistent public download URLs for sensitive media.
- **Identity/age documents:** if a reviewed verification provider requires uploads, isolate them in private paths, grant access only to the owner during upload and trusted backend/provider workflow, and delete promptly according to a documented retention policy.
- **Functions:** verify authentication, authorization, App Check where supported, and input shape on every callable/HTTP operation. Apply rate limits and idempotency where appropriate.
- **App Check:** enable enforcement gradually after validating supported app flows. App Check supplements—never replaces—Authentication and database/storage rules.
- **Secrets:** store server credentials using Functions secrets/Secret Manager. `VITE_*` values are public because Vite bundles them into client code.
- **Analytics:** do not log names, emails, photos, messages, precise location, report details, identity data, or other sensitive values. Respect consent and applicable privacy requirements.
- **Operations:** use least-privilege IAM, separate development and production Firebase projects, enable budget alerts, and document data export/deletion procedures.

Use the Emulator Suite to test allowed and denied reads/writes for each collection and Storage path. Add rule tests to CI before deployment.

## 7. Firebase service usage

### Core for the MVP

1. **Authentication** — Google and/or email sign-in; auth state drives protected routes.
2. **Firestore** — profiles, likes, matches, realtime chat, game sessions, blocks, and reports.
3. **Storage** — moderated profile photos and game media with access controlled by rules.
4. **Cloud Functions** — mutual match creation, trusted updates, competitive game validation, report orchestration, moderation workflow hooks, and notifications.
5. **Hosting** — Vite production build, HTTPS, SPA route fallback, and preview channels.
6. **Emulator Suite** — local end-to-end development and security-rule testing.
7. **App Check** — add after core flows work; monitor before enforcing.

### AI-assisted report workflow (after legal/privacy approval)

1. Obtain clear consent and provide notice describing what data is checked, the purpose, reviewers, retention, and how to dispute errors.
2. Use an appropriately vetted identity/age verification flow, or other reviewed non-biometric identifiers, to establish the subject identity. Do not identify people by comparing profile photos to registry or booking images.
3. A callable or task-queue Cloud Function retrieves only lawfully accessible, approved source data. Store source URL/identifier, retrieval time, jurisdiction, record status, and the minimum evidence needed for review.
4. Firebase Genkit with Vertex AI drafts a structured summary from that retrieved evidence only. Require citations for each factual claim, preserve uncertainty, reject unsupported claims, and do not ask the model to infer identity, guilt, danger, or a final account decision.
5. Save the draft and source metadata in restricted `safetyReports`; do not write it to `profiles` or make it discoverable to other users.
6. A trained human reviewer checks the underlying authoritative sources and identity-match basis, records a decision and rationale, and routes uncertain/conflicting cases to further review. Provide a correction/dispute path and audit every access and action.
7. Apply documented retention and deletion schedules to reports and any temporary data. Never retain uploaded identity documents or source material beyond the approved need.

Use the Firebase Local Emulator Suite for application behavior and rules tests. AI evaluation also needs a separate test set that covers false matches, stale/expunged records, same-name identities, conflicting sources, missing citations, and prompt-injection attempts. Do not use real people's sensitive information in development fixtures.

### Add when there is a user need

- **Cloud Messaging:** optional push notifications for new matches/messages. Ask permission in context and offer in-app alternatives.
- **Analytics:** consent-aware aggregated onboarding and feature usage; no personal or sensitive event payloads.
- **Remote Config:** staged rollouts and non-sensitive UI/feature flags. Never put secrets or authorization decisions in Remote Config.
- **Performance Monitoring:** identify slow page loads and Firestore interactions without collecting personal content.
- **Extensions:** consider only a well-maintained extension that exactly fits a need; review permissions, cost, and data handling first.

## 8. Hosting and deployment

Deploy the frontend and Firebase backend from one Firebase project. Keep separate development and production projects and select them explicitly.

1. Build `web/` with Vite in CI.
2. Run frontend tests, Functions type-check/build, and Emulator Suite rules tests.
3. Deploy Hosting, Firestore rules/indexes, Storage rules, and Functions through Firebase CLI.
4. Use Hosting preview channels for review before production releases.
5. Store CI deploy credentials in GitHub Actions secrets with least privilege. Never commit service-account keys.
6. Configure Firebase Hosting rewrites so client-side routes serve `index.html`; set Vite's base path for the chosen deployment URL.
7. Configure Authentication's authorized domains for local development and the production Hosting domain.
8. Set billing budgets/alerts and review Firebase quotas and pricing before enabling billable services.

Example deployment targets:

```sh
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
```

Use the Firebase CLI's project aliases for explicit staging/production deployment. Avoid a single broad deploy command in CI until each target has been reviewed.

## 9. Build phases

### Phase 0 — Scaffold and Firebase setup

- Scaffold React + TypeScript + Vite in `web/`.
- Create Firebase development and production projects.
- Add Firebase modular SDK initialization and environment example.
- Configure Hosting and deploy a minimal app.
- Configure Auth and verify sign-in locally and on the deployed domain.
- Start Emulator Suite and establish CI build/test checks.

### Phase 1 — Accounts and profiles

- Add onboarding, auth-state handling, profile editing, and photo upload.
- Define and test Firestore/Storage rules before using real user data.
- Add account deletion and profile visibility controls.

### Phase 2 — Core dating experience

- Build discover feed, likes/passes, and mutual matches.
- Use a Function for match creation and a Firestore transaction to avoid duplicate matches.
- Add block/report flows and a restricted, human-reviewed moderation queue.
- Add privacy-conscious messaging and moderation controls.

### Phase 3 — AI-assisted safety reports (only after review and approval)

- Confirm lawful source access, product purpose, consent/notice, reviewer process, dispute handling, and retention with qualified counsel/privacy reviewers.
- Define report schema, access roles, audit events, source allowlist, and a non-production test corpus before enabling source retrieval.
- Implement a rate-limited Cloud Function workflow and Genkit/Vertex AI report drafting with citations and explicit uncertainty.
- Require human verification of both identity and source records before any account action; prohibit photo-based identity matching and automatic decisions.
- Keep this feature disabled by default until source quality, false-match handling, and reviewer operations have been tested.

### Phase 4 — Realtime chat and games

- Add match-scoped realtime chat.
- Add two polished games first (for example, Would You Rather and Two Truths).
- Validate competitive moves in Functions; treat all client game state as untrusted.

### Phase 5 — Safety, reliability, and launch readiness

- Add App Check, rate limits, rule tests, abuse monitoring, and account deletion workflows.
- Add optional push notifications, Analytics, Remote Config, or Performance Monitoring only as needed.
- Test permission-denied cases, report/block behavior, data retention, and accessibility.
- Review legal/privacy obligations and all Firebase/provider costs before any real-user launch.

## 10. MVP priorities

1. Authentication and profile management.
2. Firestore/Storage rules and Emulator Suite coverage.
3. Discovery, likes, and mutual matches.
4. Block/report and human-reviewed safety workflow.
5. Realtime chat and two mini-games.
6. Firebase Hosting deployment.
7. Optional App Check, push, Analytics, Remote Config, and Performance Monitoring.
8. AI-assisted, evidence-linked safety reports only after legal/privacy approval and human-review operations are ready.

AI-assisted reports may summarize approved conviction-record data for human review, but do not use face recognition or photo-to-record matching, and do not automate identity conclusions or account decisions. Treat legal/privacy review, source accuracy, reviewer verification, and a meaningful dispute process as launch blockers for this feature.
