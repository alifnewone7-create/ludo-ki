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
- [x] Admin panel: live dashboard, match control, history — tested (iteration_1/2)
- [x] Android Gradle upgraded (Gradle 8.7 / AGP 8.3.2 / compileSdk 34 / Java 17) to build on JDK 21
- [x] Manipulation fully NATURAL: mild best/worst-of-two bias + hard cap of 2 consecutive 6s
- [x] Admin sets unique finishing POSITION per player (control/ranks/{color}=pos)
- [x] NEW: Playable 5/6-player HEXAGONAL Ludo game inside the Expo app (SVG board, 6 colors blue/yellow/purple/red/green/orange, dice, capture, safe/star cells, home columns, bots + pass-and-play). Same Firebase schema + same subtle manipulation, so it shows in the admin panel and is controllable. Tested iteration_3 (10/10 pass).
- [x] Routing: launcher '/' → Play (5/6 hex game) or Admin ('/admin' tabs). Game at /play/setup + /play/game.

## Architecture note (game split) — UPDATED June 2026
User decision: 5/6 player mode must live INSIDE the Android app, not in Expo.
- 2/3/4 players → existing native Android app (MainActivity), classic 4-quadrant board.
- 5/6 players → NEW native Android hexagonal board (HexActivity), same theme/sounds/dice/piece art.
- Expo app = Admin panel (the Expo hex game stays as a web/preview copy only).
- All write the same matches/{code} schema to Firebase, so ONE admin panel controls everything.

## Android 5/6 player hexagonal game (new files)
- `HexEngine.java` — pure logic: 6 sides × 8 = 48-cell ring, startCell(seat)=seat*8+4,
  5-cell home column, FINISH=53, 4 tokens, safe = 6 starts + 6 corner stars, 3×6 forfeits.
  Verified with 400 simulated bot games (all complete, correct ranks).
- `HexBoardView.java` — canvas board: white plate + dark grid lines + classic palette
  (blue #29ABE2, red #ED2224, green #0EA24E, yellow #FFD90F, orange #F7941E, purple #8E44AD),
  6 tinted sectors, colored start cells, star safe cells, home columns, centre rosette,
  6 outer base yards, real piece PNGs as tokens, tap-to-move hit testing.
- `HexActivity.java` + `res/layout/activity_hex.xml` — dice (dice1..6 art + roll animation),
  turn banner, player chips with live rank, bots (800ms), result overlay, game sounds,
  RemoteControl/Firebase admin control with the same subtle manipulation + 6-cap.
- `HomeActivity`: 5P/6P Play button now starts HexActivity (was "No Internet"); passes
  names, bot flags and the same colour order shown on the setup screen.
- Colour order — 5P: blue, orange, green, red, yellow | 6P: blue, yellow, purple, red, green, orange.
- Build fix: removed all `switch (view.getId()) { case R.id... }` (AGP 8 non-final res ids →
  "constant expression required") + `android.nonFinalResIds=false` in gradle.properties.

## Hex engine constants (src/game/engine.ts)
6 sides × 8 cells = 48-cell ring, 5-cell home column, finish=53 progress, 4 tokens/player.
Safe cells: 6 starts + 6 mid-side stars. 3 consecutive 6s forfeits turn.

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
