# PicklePulse

Run pickleball tournaments with live standings, court boards and TV mode — branded for each club.

- **Formats:** round robin for **Teams** (club vs club, MD / WD / XD or your own categories) and **Doubles** (fixed pairs)
- **Skill levels:** Novice, Low Intermediate, High Intermediate, Advanced — separate standings per level, or one pool with levels as labels
- **Branding:** club logo, name and colors on every page
- **Scorekeeper:** per-court ongoing game, auto-advance after a final, game timer, team substitutions, player tracking
- **Public live page + TV mode:** no login needed to watch

## Run it (demo mode, no database)

```bash
npm install
npm run dev        # http://localhost:3000/app
```

Without Supabase keys the app runs in **demo mode**: data is stored in your browser only
(tabs of the same browser stay in sync). Great for trying the wizard and scoring.

## Run it for real (Supabase + Vercel)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor run `supabase/migrations/0001_init.sql`
   (tables, row-level security, realtime, logo storage).
3. Authentication → URL configuration: add your site URL and `https://YOUR-SITE/auth/callback` as redirect URL.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
5. `npm run dev` — sign in with an email link, create your club, create an event.
6. Deploy on [Vercel](https://vercel.com): import this repo and add the same two environment variables.

## How it is built

| Path | What |
|---|---|
| `src/lib/engine/` | Pure TypeScript: schedule generator, standings, score rules (15 unit tests: `npm test`) |
| `src/lib/repo/` | One `Repo` interface, two backends: `local.ts` (demo) and `supabase.ts` |
| `src/components/live/` | Standings, court cards, upcoming list (used by public page, TV and scorekeeper) |
| `src/app/e/[club]/[event]` | Public live page and `/tv` |
| `src/app/app/` | Dashboard, new-event wizard, branding, scorekeeper (`/app/[club]/[event]/admin`) |
| `supabase/migrations/` | Database schema and policies |

Who can do what (enforced by Supabase row-level security): anyone can read a live/finished public event;
club **owners** manage branding, events and schedules; **scorekeepers** can write results and court cursors only.

## Status

Phase 1 (this repo): single club per login, event wizard, round robin for teams and doubles, branding,
public live page, TV mode, scorekeeper.

Not built yet (planned):
- inviting scorekeepers by email (the `club_members` table and policies already support it)
- finals / playoff bracket generation (standings already flag who advances)
- player coverage report ("has every player faced every team?"), CSV export, removing a game from the schedule
- read-only share snapshot, billing, templates, player history across events

Supabase and the sign-in flow could not be tested against a live project in the build environment;
the engine, wizard, scoring, public page and TV mode were tested end to end in demo mode.
