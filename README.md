# Dua Tracker (Firebase)

React + TypeScript + Vite, Firebase Auth, Cloud Firestore.

## Firebase setup
1. Create a project at console.firebase.google.com.
2. Build > Authentication > Sign-in method: enable **Email/Password**.
3. Build > Firestore Database: create a database (production mode).
4. Project settings > Your apps > add a **Web app**; copy its config values.
5. `cp .env.example .env.local` and fill in:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`.
   (These web config values are public identifiers; access is enforced by the security rules. Never put a service-account key in this app.)
6. Authentication > Settings > Authorized domains: add your deployed domain.

## Run
```
npm install
npm run dev
```

## Deploy
```
npm install -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```

## Data model (all under `users/{uid}/`)
- `duas/{id}`: title, text, kind (`required`|`optional`), schedule, order
- `completions/{duaId}_{YYYY-MM-DD}`: one deterministic ID per dua per Cairo day, so duplicates cannot exist
- `settings/rotation`: activeIds (max 5), doneIds, cycle (version used for optimistic concurrency)
- `settings/prefs`: largeText

## Behavior notes
- Date keys always use Africa/Cairo.
- Required duas appear only when due (daily, selected weekdays, or every N days from an anchor date).
- Optional duas form one ordered pool; five show at a time. Completing the fifth advances the group inside a single Firestore transaction, so two devices cannot double-advance or corrupt it. Completing an optional dua therefore requires a connection; required checkmarks work offline.
- Import validates the file before writing and is safe to repeat (same IDs overwrite).

## Verify before relying on it (not yet done against a live project)
1. Sign in on two browsers; add a dua on one, confirm it appears on the other.
2. Tick a required dua on one; confirm it is ticked on the other.
3. Complete all five optional duas on one device; confirm both show the same new group, then reload.
4. Go offline (DevTools), tick a required dua, reconnect, confirm it syncs.
5. In the Rules Playground, confirm another user's UID cannot read `users/{yourUid}/...`.
6. Export, delete a dua, import, confirm it returns.

## Demo build
`npm run build:demo` bundles the same UI with an in-browser stand-in for Firebase (`src/demo/`) into one HTML file in `dist-demo/`. It is for previewing only and never talks to Firebase.
