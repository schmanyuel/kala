# kala — Architecture & Roadmap

## Goal

A personal, self-hostable time-tracking web app: track work hours, calculate gross
pay (Gehalt) from an hourly wage, and see a dashboard overview.

## Architecture decisions

- **Self-hostable** — runs in the user's homelab, not a managed cloud service.
- **Plain Postgres in Docker**, not self-hosted Supabase — Supabase's extra moving
  parts (Auth, Realtime server, Storage, GoTrue, etc.) are unnecessary complexity
  for a single-user app. Realtime is achieved directly via Postgres
  `LISTEN`/`NOTIFY`, so Supabase brings no benefit here.
- **SvelteKit** as the full-stack framework (explicit user preference), with
  **Drizzle ORM** and **Tailwind CSS**.
- **No auth initially** — protected at the network level (homelab/Tailscale).
  Optional auth is deferred to the polish phase.
- **Realtime sync** — Postgres `LISTEN`/`NOTIFY` pushed to clients over
  Server-Sent Events (SSE), not a WebSocket. Same one-way push behavior with far
  fewer moving parts (no upgrade handling to wire into both the Vite dev server
  and adapter-node's production server). No external realtime service needed.
- **PWA, not Capacitor** — Android has strong PWA support (the user's priority
  platform), so a installable PWA is sufficient for now. Capacitor (native wrapper,
  needed mainly for iOS/deeper native APIs) is deferred and only revisited if
  actually needed.
- **Simplified German Brutto→Netto tax calculation** (Steuerklassen, Minijob,
  Sozialabgaben) is wanted eventually but is explicitly **not a priority**.
- **Design**: minimal, unobtrusive accents now; a more premium visual pass and
  dark mode are deferred to the final polish phase.
- **Money** stored as integer cents, never floats.
- **Historized wage rates** so a job's hourly rate can change over time without
  rewriting history.
- **English UI with a German option** — the app is currently German-only. It moves
  to English as the default language, with a switch between English and German.

## Phases

### Phase 1 — MVP ✅ done

Postgres/Drizzle setup, timer start/stop + manual entries, day/week overview,
hourly wage, gross pay calculation.

### Phase 2 — Dashboard & Auswertung ✅ done

Weekly target hours setting, Überstunden (overtime) vs. Soll-Arbeitszeit on the
week overview, a stats page (weekly-hours trend chart + per-job breakdown chart,
built with a validated CVD-safe categorical palette), and CSV/PDF export of time
entries for a date range.

### Phase 3 — Realtime & PWA ✅ done

- Postgres `NOTIFY` on entry/timer changes → SSE → live client updates
  (no manual refresh needed, e.g. when the same account is open on two devices).
- PWA manifest + service worker so the app is installable on Android.

### Phase 4 — Steuer/Sozialabgaben

- Simplified Brutto→Netto calculation.
- Steuerklassen, Minijob-Grenze, support for multiple simultaneous jobs.

### Phase 5 — Politur

- Optional auth.
- Premium visual design pass, dark mode.
- Possible Capacitor wrap if native/iOS need arises.

### Phase 6 — English & language switch

- Translate the UI to English and make English the default.
- Language switch (English / Deutsch) in the settings, stored in the `settings` row
  so every device uses the same language.
- Dates, times and currency formatted for the selected locale via `Intl`
  (no more hard-coded `de-DE`).
- CSV and PDF exports in the selected language.
- German-specific terms (Minijob, Brutto) get an English label plus a short
  explanation instead of a literal translation.
