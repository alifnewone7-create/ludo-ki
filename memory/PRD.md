# PRD — Ludo Game + Remote Admin Panel (LUDO OPS)

## Original Problem Statement (Bengali user)
Build a Ludo app like the GitHub repo https://github.com/Vinaykpro/Ludo_King_Clone.git, plus an
admin panel: when any ludo match is running, admin panel shows it (with match code). Admin can set
who finishes 1st and 2nd; through subtle dice manipulation that player eventually wins while the
game looks completely normal. Connection between game and admin panel via Firebase Realtime
Database (user provided the firebase config for project `ludoking-anondo`).

## User Choices
- Local multiplayer (repo supports 2–4 players; 5–6 not supported by this board)
- Admin panel as separate app (this Expo app IS the admin panel, no login, direct access)
- Manipulation must be subtle so nobody notices
- Ludo game itself is a native Android app: user builds it with Android Studio from `/app/ludo-android`

## Architecture
- `/app/ludo-android` — cloned Android Studio (Java) Ludo game, modified:
  - `RemoteControl.java` (NEW): Firebase RTDB REST client (no google-services.json needed).
    Creates `matches/{6-digit code}` on game start, polls `control` node every 1.5s,
    reports rolls/turns/progress/winners, marks match finished/abandoned.
  - `MainActivity.java`: `manipulatedDice()` (70% smart roll for rank1, 45% for rank2,
    60% weak roll for others — rest natural so it looks legit), `bestDiceFor/worstDiceFor`,
    progress reporting, match-code overlay on game screen, winner reporting, INTERNET permission.
  - `ADMIN_SETUP_README.md`: Bengali build instructions.
- `/app/frontend` — Expo admin panel ("LUDO OPS", dark ops-room design):
  - `(tabs)/index.tsx` Live matches dashboard (realtime, connection pill, manipulation badge)
  - `match/[id].tsx` Match Control: recent rolls, player progress, TURN indicator,
    force next dice 1–6 per player, set 1st/2nd, Apply/Clear sticky CTA, toasts, haptics
  - `(tabs)/history.tsx` finished/abandoned matches with rankings
  - `src/lib/firebase.ts` Firebase JS SDK (config in frontend/.env EXPO_PUBLIC_FIREBASE_*)
- FastAPI backend: intentionally unused (data flows app ↔ Firebase RTDB directly).

## Firebase RTDB Schema
`matches/{code}`: code, status(live|finished|abandoned), createdAt, nop, gametype,
players{color:{name,isBot,order}}, state{currentTurn,lastRoll,recentRolls[≤14],progress{color:0-224}},
winners{pos:{color,name}}, control{rank1,rank2,force{color:0-6}}

## Implemented (June 2026)
- [x] Android game wired to Firebase (REST) with subtle dice manipulation — needs real-device build to verify
- [x] Admin panel: live dashboard, match control, history — fully tested (iteration_1.json, 7/7 pass)
- [x] Fonts Barlow Condensed + DM Sans, dark theme per design_guidelines.json
- [x] Android Gradle upgraded (Gradle 8.7 / AGP 8.3.2 / compileSdk 34 / Java 17 / namespace) to build on JDK 21
- [x] Manipulation reworked to be fully NATURAL: subtle luck bias via best/worst-of-two natural rolls (favored 32%/20% nudge, last-place 22% down-nudge, mids untouched) + hard cap of max 2 consecutive 6s per color (kills the abnormal 8/9-six streak). No optimal-move solver anymore.
- [x] Admin can now set a unique finishing POSITION (1st..Nth) for EVERY player, not just 1st/2nd. control/ranks/{color}=pos. Tested iteration_2 (9/9 pass).

## Known Limitations
- Board is classic 4-quadrant: supports only 2/3/4 players. 5/6-player options in the original repo route to the online "no internet" screen (true 5-6 player Ludo needs a hexagonal board = full rewrite, not in this codebase).

## Backlog
- P1: Verify Android game end-to-end after user builds APK in Android Studio
- P1: Admin panel deploy + Expo Go usage by user
- P2: Kill/capture-aware manipulation (avoid capturing favored player's pieces)
- P2: Manipulation intensity slider (subtle/normal/aggressive)
- P2: Admin PIN lock (user said not needed for now)
- P2: Firebase security rules (currently public read/write)

## Test Credentials
None required (no auth). Firebase RTDB is public read/write.
Seeded demo match: matches/482913 (live) for admin panel preview.
