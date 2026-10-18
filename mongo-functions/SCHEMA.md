# SafeMatch Atlas model

Firebase Authentication owns login credentials and UID assignment. Firebase Storage owns uploaded photos. MongoDB Atlas stores application records keyed by the Firebase UID. Background-check output stays in the restricted Firestore `screenings/{uid}` document.

## Collections

| Collection | One document represents | Bounded fields / references |
| --- | --- | --- |
| `users` | Private app account for one UID | Email, onboarding step, settings, screening-consent time, legacy-migration marker. Never password data. |
| `profiles` | One public profile for one UID | Display name, age, gender and optional self-description, pronouns, city/region, bio, up to 6 photo references, up to 10 interests, up to 3 prompts, quiz summary, discoverable flag. |
| `preferences` | One private matching preference for one UID | Gender groups sought, optional “Other” description, age range (18–120), relationship intention. Never sent with another person's profile. |
| `likes` | One directed like or pass from one UID to another | `fromUid`, `toUid`, `action`, timestamps. Unique compound index on (`fromUid`, `toUid`). |
| `matches` | One unordered pair with a mutual like | `matchId` derived from sorted UIDs, sorted `users`, `status`, timestamps, latest-message preview. Unique match ID. |
| `messages` | One message in one match | `matchId` reference, sender UID, bounded text/game payload, timestamp. Separate collection so chat history is unbounded without growing match documents. |
| `quizResults` | Latest quiz result for one UID | Persona, bounded axes and answers, completion time. |
| `wyrAnswers` | One member's bounded Would You Rather answers | Prompt ID to `a`/`b` map. Read by that member or their active match only. |
| `blocks` | One directed block from one UID to another | Unique compound index; queried both directions to hide profiles and matches. |
| `userReports` | One submitted moderation report | Reporter, reported UID, reason, bounded details, status and creation time. |

## Matching integrity

The client never writes likes or matches directly. `mongoSetLike` verifies the caller, target visibility, and block state, then uses an Atlas transaction to upsert the directed like and check the reciprocal like. Only a reciprocal pair creates one deterministic `matches` document and its initial system message. Compound unique indexes prevent duplicate likes and matches during simultaneous requests. Match status is retained as `unmatched` or `blocked` rather than deleting the pair; messages are stored separately and are only returned to active participants.

Discovery requires both people to fit each other's private gender, age-range, and relationship-intention preferences. Previously liked/passed or blocked profiles are excluded server-side. Preference documents are never returned for other people.

## Firestore migration

On sign-in, `mongoMigrateMyData` copies only that authenticated member's legacy account, profile, quiz, game answers, outgoing likes, blocks, matches, and match messages. MongoDB uses upserts and a completion marker, so retries are safe. The function leaves Firestore records in place; it does not migrate `screenings` or private background-check output.
