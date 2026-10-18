# Frontend Spec — Dating App (Cozy Pastel Arcade)

Owner: UI / auth / games team. Lives in `web/`.
Platform: **100% Firebase** — Firebase Hosting, Authentication, Firestore, Storage, Cloud Functions. No Vercel, no separate API server.

---

## 1. Goals

1. A dating app that feels like a cozy pastel arcade: playful, glossy, 3D, and bouncy, but still trustworthy.
2. Core loop: sign in → build profile → take the Compatibility Quiz → discover profiles → like/pass → match → chat → play Would You Rather together.
3. An optional safety report a user can request about a match, rendered from the screening team's `report.json`, in a calmer visual style.
4. Works on phones first, and also on desktop.
5. Every push to `main` redeploys to Firebase Hosting.

### Non-goals (for the hackathon)
- Native mobile apps, payments, real-time location, push notifications.
- Any "verified safe" badge or safety score on profiles.
- The frontend running background checks itself. It only requests them and displays results.

---

## 2. Tech stack

| Area | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Static build output (`web/dist`) deployed to Firebase Hosting |
| Routing | React Router (`createBrowserRouter`) | Firebase Hosting rewrites all routes to `index.html` |
| Styling | Tailwind CSS | Design tokens in `tailwind.config.ts` (section 4) |
| Motion | Framer Motion | Spring physics, page transitions, drag-to-swipe |
| 3D | CSS 3D transforms for cards/buttons; `@react-three/fiber` + `drei` **only** for the mascot and gachapon machine, lazy-loaded | Keeps first load light |
| Confetti | `canvas-confetti` | Match + quiz-result celebrations |
| State | Zustand (UI state) + Firestore listeners (server state) | |
| Forms/validation | React Hook Form + Zod | Zod schemas shared with types |
| Firebase | Modular JS SDK v10+: `auth`, `firestore`, `storage`, `functions`, `app-check` | Initialized once in `src/lib/firebase.ts` |
| Fonts | Fredoka (headings, buttons), DM Sans (body, chat, report) | Self-hosted via `@fontsource` |
| Icons | Lucide React + custom SVG stickers | |
| Testing | Vitest + React Testing Library; Playwright for e2e at 390px and 1280px widths | Run against the Firebase Emulator Suite |

---

## 3. Firebase integration

### Auth
- **Google sign-in** via `signInWithPopup(auth, new GoogleAuthProvider())`.
- **Demo login fallback:** Firebase anonymous auth, plus a "Load demo profiles" button. Clearly labeled "Demo mode." Lets the team keep building if Google sign-in breaks.
- `useAuth()` hook exposes `{ user, loading, signInWithGoogle, signInDemo, signOut }`.
- Route guards:
  - `RequireAuth`: redirect to `/login` if signed out.
  - `RequireProfile`: redirect to `/onboarding` if `users/{uid}.onboardingStep !== 'complete'`.
- Authorized domains: `localhost`, `<project>.web.app`, `<project>.firebaseapp.com` (the last two are added by Firebase automatically).

### Firestore (client reads/writes)
| Collection | Frontend use | Client can write? |
|---|---|---|
| `users/{uid}` | Onboarding step, settings | Own doc, safe fields only |
| `profiles/{uid}` | Discover, profile pages | Own doc only |
| `likes/{fromUid_toUid}` | Like / pass | Create own only |
| `matches/{matchId}` | Matches list | No (created by a Function on mutual like) |
| `matches/{matchId}/messages/{id}` | Chat | Participants only |
| `quizResults/{uid}` | Persona + answers for match % | Own doc only |
| `wyrAnswers/{uid}/answers/{promptId}` | Would You Rather picks | Own only |
| `reportRequests/{requestId}` | Report status | No (created by a Function); requester reads |
| `blocks/{uid}/blocked/{otherUid}`, `reports/{id}` | Block / report user | Own only |

All realtime views use `onSnapshot` listeners wrapped in hooks (`useMatches`, `useMessages`, `useReportRequest`...).

### Cloud Functions (called from the frontend)
| Callable | Input | Returns | Owner |
|---|---|---|---|
| `requestSafetyReport` | `{ subjectUid?, subjectName, context?, confirmedScope: true }` | `{ requestId }` | Screening team |
| `getSafetyReport` | `{ requestId }` | `SafetyReport` (the `report.json` object) | Screening team |
| `onLike` (Firestore trigger, not callable) | — | creates `matches/{id}` | UI team |

The frontend never holds AI or search API keys. Only `VITE_FIREBASE_*` web config goes in `web/.env`, which is public by design.

### Storage
- `profilePhotos/{uid}/{photoId}.webp`: client resizes to max 1080px, converts to WebP, under 2 MB.
- No other client uploads for the MVP.

### App Check
- reCAPTCHA Enterprise provider, initialized in `firebase.ts`. Enable in monitoring mode first; enforce once flows work.

### Emulators
- `npm run dev:emulators` starts Auth, Firestore, Storage, Functions emulators. When `VITE_USE_EMULATORS=true`, `firebase.ts` calls `connect*Emulator`.
- `npm run seed` loads labeled demo profiles into the emulator.

---

## 4. Visual design system — "Cozy Pastel Arcade"

### Mood
A pastel toy arcade: gachapon capsules, puffy stickers, chunky arcade buttons, collectible cards, soft floating shapes. Playful everywhere except the safety report, which switches to a calm frosted-glass style.

### Color tokens
| Token | Hex | Use |
|---|---|---|
| `cream` | `#FFF8F3` | App background |
| `blush` | `#FFE4EE` | Section backgrounds, chat bubbles (theirs) |
| `bubblegum` | `#FF7EB6` | Primary (Like, main CTAs) |
| `bubblegum-deep` | `#E05A97` | 3D button lip for primary |
| `peach` | `#FF9E7D` | Secondary accents |
| `mint` | `#6EE7B7` | Success, "same answer!" |
| `lilac` | `#C4B5FD` | Games, persona badges |
| `butter` | `#FDE68A` | Tokens, highlights, stars |
| `sky` | `#A5D8FF` | Info, chat bubbles (mine) |
| `ink` | `#3B2F4A` | Text (never pure black) |
| `ink-soft` | `#6B5E7B` | Secondary text |

All text on pastel backgrounds must meet WCAG AA (4.5:1) — use `ink` for text, not white, on light pastels.

### Typography
- Headings / buttons: **Fredoka** 600–700, sizes 32 / 24 / 20.
- Body: **DM Sans** 400–500, 16px base, 1.5 line height.

### Shape and depth
- Radius: 16px (small), 24px (cards), 9999px (pills, buttons).
- **Glossy 3D recipe** (reusable `.gloss` utility):
  - top-inner highlight: `inset 0 3px 6px rgba(255,255,255,.85)`
  - bottom-inner shade: `inset 0 -4px 8px rgba(59,47,74,.08)`
  - solid lip: `0 6px 0 <deep color>` plus a soft drop shadow
  - a curved white gradient overlay on the top 40% for the "candy shine"
- **Pressed state:** `translateY(4px)` and lip shrinks to `0 2px 0`, 80ms.

### Motion rules
- Default spring: `{ type: 'spring', stiffness: 400, damping: 25 }`.
- Page transitions: slide + fade, 250ms.
- Ambient background: 6–10 slow-floating pastel shapes (hearts, stars, coins, clouds), CSS keyframes, 20–40s loops.
- **`prefers-reduced-motion`:** disable ambient floating, tilt, and confetti; keep simple fades.
- 3D canvas (mascot, gachapon) is paused when off-screen or the tab is hidden.

### Core components (`src/components/ui/`)
| Component | Description |
|---|---|
| `ArcadeButton` | Chunky glossy pill with 3D lip; variants `primary`, `secondary`, `ghost`, `danger`; sizes `sm/md/lg`; press animation; loading state |
| `ArcadeCard` | Rounded glossy panel; optional `tilt` prop for 3D cursor/gyro tilt + holographic sheen |
| `Sticker` | Puffy die-cut interest tag with emoji, slight random rotation, wiggle on hover |
| `Capsule` | Glossy gachapon capsule (two-tone halves) used for loaders, rewards, prompts |
| `TokenCounter` | Butter-yellow coin + count, bounces when it changes |
| `PersonaBadge` | Collectible badge for the quiz result (lilac holographic) |
| `VibeMeter` | Pill showing match %, fills with a gradient |
| `Modal` / `Sheet` | Spring pop-in modal; bottom sheet on mobile |
| `Toast` | Small capsule toast, top-center |
| `Avatar` | Round photo with pastel ring; online dot |
| `EmptyState`, `ErrorState`, `Skeleton` | Every list and page has all three |
| `Mascot` | Lazy-loaded 3D buddy (glossy heart-capsule character); SVG fallback |

### Layout
- `AppShell`: ambient background + top `PlayerBar` (avatar, tokens, demo-mode label) + floating bottom `ArcadeDock`.
- `ArcadeDock` tabs: **Discover**, **Arcade**, **Matches**, **Profile**. On desktop (≥1024px) the dock becomes a left sidebar and content is centered at max 480px for card views, 960px for others.

---

## 5. Pages and routes

| Route | Page | Auth | Description |
|---|---|---|---|
| `/` | Landing | Public | Hero with floating mascot, tagline, "Start playing" → `/login`. Short "how it works" in 3 capsules. |
| `/login` | Login | Public | "Continue with Google" + "Try demo mode". |
| `/onboarding` | Onboarding | Auth | 4 steps with a progress bar of capsules (section 6). |
| `/discover` | Discover | Auth + profile | Card stack (section 7). |
| `/profile/:uid` | Profile detail | Auth + profile | Full profile, stickers, persona badge, vibe meter, Like/Pass, Block/Report. |
| `/arcade` | Arcade hub | Auth + profile | Gachapon machine to pick a game; list of games with play counts. |
| `/arcade/quiz` | Compatibility Quiz | Auth + profile | Section 8.1. |
| `/arcade/would-you-rather` | Would You Rather | Auth + profile | Section 8.2. |
| `/matches` | Matches | Auth + profile | Grid of matched collectible cards, newest first, unread dots. |
| `/chat/:matchId` | Chat | Participants | Section 9. |
| `/safety/:matchId/request` | Report request | Participants | Scope notice + confirm (section 10). |
| `/safety/report/:requestId` | Report results | Requester only | Renders `report.json` (section 10). |
| `/me` | My profile | Auth | Edit profile, photos, retake quiz. |
| `/settings` | Privacy & settings | Auth | Discoverable toggle, blocked users, my reports, delete account/demo data, sign out. |
| `*` | 404 | Public | "Game over" capsule with a button home. |

---

## 6. Onboarding

Steps (saved after each step so users can resume):
1. **Basics:** display name, birthdate (must be 18+), gender, interested in.
2. **Photos:** 1–6 photos, drag to reorder, first is the cover. Upload progress per photo.
3. **About you:** bio (max 300 chars), pick 3–10 interest stickers from a sticker sheet, 2 prompts ("My perfect Sunday…", "I'll beat you at…").
4. **Quiz:** start the Compatibility Quiz (can skip; Discover shows "Take the quiz to see vibe %").

Completion: confetti + mascot wave, then `/discover`.

---

## 7. Discover

- A stack of 3 `ArcadeCard`s (top card interactive, two peeking behind).
- Card front: cover photo, name + age, city, up to 4 stickers, `VibeMeter` if both users finished the quiz, persona badge.
- Tap card → flips (3D Y-rotation) to show bio and prompts. Tap "Full profile" → `/profile/:uid`.
- **Like:** swipe right or tap the bubblegum heart button. **Pass:** swipe left or tap the ✕ button. Keyboard: ← / →.
- Drag gives live tilt and a "LIKE" / "PASS" stamp that fades in.
- Writes `likes/{me_them}`. If a match is created, show the **"CO-OP MATCH!"** modal: both cards slide together, confetti, buttons "Say hi" → chat, and "Keep playing".
- Feed query: `profiles` where `discoverable == true`, excluding self, already liked/passed, and blocked users. Demo profiles are labeled with a "Demo" sticker.
- Empty state: mascot asleep, "You've seen everyone! Play a game while new players join."

---

## 8. Games (core features)

Each game earns **tokens** (cosmetic only, shown in `TokenCounter`).

### 8.1 Compatibility Quiz — "What's your co-op player type?"
- 10 questions, one per screen, 2–4 illustrated answer cards. Progress shown as capsules filling.
- Each answer maps to scores on 4 axes: **Cozy ↔ Adventurous**, **Planner ↔ Spontaneous**, **Chatty ↔ Chill**, **Night Owl ↔ Early Bird**.
- Result: one of 8 personas (e.g. *Cozy Café Strategist*, *Golden Retriever Adventurer*, *Midnight Arcade Gremlin*, *Sunday Market Wanderer*), revealed by a capsule cracking open with confetti. Shareable badge on profile.
- Saves `quizResults/{uid}`: `{ personaId, axes: {cozyAdventurous, plannerSpontaneous, chattyChill, nightEarly}, answers, completedAt }`.
- **Vibe %** between two users = `100 - average absolute axis difference` (computed on the client from both `quizResults` docs; just for fun, labeled as such).
- Question bank in `src/games/quiz/questions.ts` (static, no backend needed).

### 8.2 Would You Rather — Capsule Machine
- A 3D gachapon machine. Drag/tap the crank → a capsule drops and pops open with a prompt.
- Two big tilted `ArcadeCard` options side by side (stacked on mobile). Tap one → card squishes, then shows:
  - "**X of your matches** picked this too!" with their avatars.
  - Buttons: "Send to chat" (pick a match → posts a `game_share` message), "Next capsule."
- Saves `wyrAnswers/{uid}/answers/{promptId}`: `{ choice: 'a' | 'b', answeredAt }`.
- In chat, a `game_share` message renders as a mini capsule card: the prompt, the sender's pick, and buttons for the other person to answer. Both answers revealed together.
- Prompt bank in `src/games/wouldYouRather/prompts.ts` (60+ prompts, mix of silly and deep, tagged).

---

## 9. Matches and chat

- Matches page: collectible cards in a grid with last message preview and unread dot.
- Chat:
  - Header: avatar, name, persona badge, overflow menu (**View profile**, **Request safety report**, **Block**, **Report**, **Unmatch**).
  - Bubbles: mine in `sky`, theirs in `blush`, rounded 20px, timestamps on tap.
  - Composer: text input, send button, **🎰 game button** that opens a Would You Rather capsule to send.
  - Message types: `text`, `game_share`, `system` ("You matched! Say hi 👋").
  - Max 1000 chars, trimmed, sent with `serverTimestamp()`.
  - Empty state: 3 suggested icebreakers based on shared stickers.

---

## 10. Safety report UI

The report is optional, requested by one user about a match, and visible **only to the requester**. Never shown to the subject, other matches, or on profiles.

### Visual change
Report screens switch from arcade style to a **calm frosted-glass notebook**: pearl background with `backdrop-blur`, lilac and sage accents, DM Sans throughout, no confetti, no mascot jokes, no game sounds.

### Request flow (`/safety/:matchId/request`)
1. Explain scope in plain language: what is searched, that results may be incomplete or about a different person with the same name, and that it is not a formal background check.
2. Fields: name to search (prefilled from profile, editable), optional broad location (city/state).
3. Required checkbox: "I understand the limits of this report."
4. "Run report" → calls `requestSafetyReport` → navigates to the results page.

### Results page (`/safety/report/:requestId`)
- While running: 3-step progress tracker **Searcher → Verifier → Analyzer**, driven by `reportRequests/{id}.status`.
- When complete: fetch via `getSafetyReport` and render:
  1. **Required notice** at the top, always visible:
     > SafeMatch provides a limited summary of accessible public sources. Information may be incomplete or inaccurate, and identity may be uncertain. This is not a formal criminal-history check and cannot guarantee personal safety.
  2. **Search coverage:** sources searched, sources not accessible, whether the search completed.
  3. **Summary:** the neutral summary text.
  4. **Findings:** one collapsible card per finding with description, `identity_assessment` pill, `case_status` pill, date, jurisdiction, source title + link (opens in new tab), excerpt, conflicts, limitations.
  5. **Limitations and errors.**
  6. **Next steps:** how to check original records yourself.
- Badge labels (never "safe" or "dangerous"):

| Field value | Label shown | Color |
|---|---|---|
| `strong_match` | Strong identity match | lilac |
| `possible_match` | Possible match | butter |
| `weak_match` | Weak match | sky |
| `unresolved` | Identity unresolved | gray |
| `conviction` / `guilty_plea` | Conviction / Guilty plea | peach |
| `charge_pending` | Charge pending (not a conviction) | butter |
| `acquitted` / `dismissed` | Acquitted / Dismissed | mint |
| `allegation_only` / `civil_finding` | Allegation only / Civil finding | sky |
| `unknown` | Status unknown | gray |

- **No findings:** show "No matching records were found in the sources searched. This does not mean no records exist." — never "clean" or "safe."
- **Incomplete / errors:** amber banner listing what failed.
- **Demo fixtures:** a "Synthetic demo data" ribbon on every report built from fixtures.
- `src/types/safetyReport.ts` mirrors the `report.json` schema in `claude.md` section 7, validated with Zod before rendering. Invalid JSON shows an error state, not a partial render.

---

## 11. Folder structure (`web/`)

```
web/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── package.json
├── .env.example
├── public/
│   ├── favicon.svg
│   └── models/                  # mascot.glb, gachapon.glb (optional)
└── src/
    ├── main.tsx
    ├── App.tsx                  # router + providers
    ├── lib/
    │   ├── firebase.ts          # init, emulators, App Check
    │   ├── image.ts             # resize/convert uploads
    │   └── vibe.ts              # vibe % calculation
    ├── types/                   # user, profile, match, message, quiz, wyr, safetyReport
    ├── hooks/                   # useAuth, useProfile, useDiscoverFeed, useMatches, useMessages, useReportRequest
    ├── store/                   # Zustand: ui, tokens, demo mode
    ├── routes/
    │   ├── Landing.tsx
    │   ├── Login.tsx
    │   ├── onboarding/          # Basics, Photos, About, QuizIntro
    │   ├── Discover.tsx
    │   ├── ProfileDetail.tsx
    │   ├── arcade/              # ArcadeHub, Quiz, WouldYouRather
    │   ├── Matches.tsx
    │   ├── Chat.tsx
    │   ├── safety/              # RequestReport, ReportResults
    │   ├── MyProfile.tsx
    │   ├── Settings.tsx
    │   └── NotFound.tsx
    ├── components/
    │   ├── ui/                  # ArcadeButton, ArcadeCard, Sticker, Capsule, ...
    │   ├── layout/              # AppShell, PlayerBar, ArcadeDock, RequireAuth, RequireProfile
    │   ├── three/               # Mascot, GachaponMachine (lazy-loaded)
    │   ├── discover/            # CardStack, SwipeCard, MatchModal
    │   ├── chat/                # MessageList, Bubble, GameShareCard, Composer
    │   └── safety/              # ProgressTracker, FindingCard, StatusPill, Notice
    ├── games/                   # pure logic, unit-tested
    │   ├── quiz/                # questions.ts, scoring.ts, personas.ts
    │   └── wouldYouRather/      # prompts.ts
    ├── fixtures/                # demo profiles + sample report.json (labeled synthetic)
    └── styles/
        └── globals.css          # .gloss utility, fonts, ambient keyframes
```

---

## 12. Deployment (Firebase Hosting)

- `firebase.json` hosting: `public: "web/dist"`, rewrite `**` → `/index.html`, long cache headers for hashed assets, no-cache for `index.html`.
- Vite `base: '/'` (Firebase Hosting serves at the root).
- GitHub Actions using `FirebaseExtended/action-hosting-deploy`:
  - push to `main` → build `web/` → deploy to the **live** channel.
  - pull request → deploy to a **preview channel** and comment the URL on the PR.
- Secrets in GitHub: `FIREBASE_SERVICE_ACCOUNT`, `VITE_FIREBASE_*`.
- Note: Google sign-in works on preview channel URLs only after adding them to Authorized domains; test login on live or localhost.

---

## 13. Accessibility and quality bar

- Mobile-first; tested at 360, 390, 768, 1280px.
- All interactive elements keyboard reachable with visible focus rings (bubblegum outline).
- Swipe actions always have button equivalents.
- Images have alt text; decorative 3D/ambient elements are `aria-hidden`.
- `prefers-reduced-motion` respected (section 4).
- Every data view has loading (skeleton), empty, and error states.
- Lighthouse targets on Discover: Performance ≥ 85 mobile, Accessibility ≥ 95.
- Initial JS bundle under ~250 KB gzipped; 3D code lazy-loaded.

---

## 14. Testing

- **Unit (Vitest):** quiz scoring, persona assignment, vibe %, WYR prompt selection, report Zod parsing, status-pill labels (pending charge never shown as conviction; empty findings never shown as "clean").
- **Component (RTL):** ArcadeButton states, SwipeCard like/pass, FindingCard rendering, required notice always present.
- **E2E (Playwright + emulators):** demo login → onboarding → quiz → like a demo profile → match → chat → send WYR → request report → view fixture report. Run at mobile and desktop widths.
- **Rules (emulators):** a user cannot read another user's `reportRequests` or messages from matches they're not in.

---

## 15. Build order

1. **Scaffold:** Vite + TS + Tailwind + Router + Firebase init + emulators + Hosting deploy workflow. Deploy a "hello arcade" page.
2. **Design system:** tokens, fonts, `.gloss`, ArcadeButton, ArcadeCard, Sticker, Capsule, AppShell, ArcadeDock. A `/dev/ui` page to preview components.
3. **Auth + onboarding:** Google + demo login, guards, 4 onboarding steps, photo upload.
4. **Discover + matching:** card stack, swipe, likes, match modal (with the `onLike` Function).
5. **Compatibility Quiz:** questions, scoring, persona reveal, vibe % on cards.
6. **Matches + chat:** list, realtime chat, icebreakers.
7. **Would You Rather:** capsule machine, answers, send-to-chat, in-chat game card.
8. **Safety report UI:** request flow + results page against the fixture `report.json`; switch to the real callable when the screening team is ready.
9. **3D polish:** mascot, gachapon machine, holographic tilt, confetti, sounds (muted by default).
10. **QA:** accessibility, reduced motion, mobile pass, tests green.

---

## 16. Contracts to agree with the screening team

1. Final `report.json` schema (start from `claude.md` section 7) and a synthetic sample file in `web/src/fixtures/`.
2. `requestSafetyReport` and `getSafetyReport` input/output shapes (section 3).
3. `reportRequests/{id}.status` values: `queued`, `searching`, `verifying`, `analyzing`, `complete`, `incomplete`, `failed`.
4. Where the report is stored server-side (Firestore or private Storage). The frontend only uses `getSafetyReport`, so this can change without UI changes.

## 17. Open questions

- App name: **SafeMatch** (`claude.md`) or **Vetted** (`PLAN.md`)?
- `claude.md` section 4 still recommends Next.js + Supabase; update it to match this spec and `PLAN.md` (React + Vite + Firebase).
- `PLAN.md` says reports are visible only to trained reviewers; this spec follows `claude.md` (requester sees their own report). The team should confirm.
- Sound effects: in or out?
