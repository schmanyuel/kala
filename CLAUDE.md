# kala

Self-hostable personal time-tracking app: track work hours, calculate gross pay from
hourly wage, and get a dashboard overview. Single-user, no auth (network-level
protection via homelab/Tailscale is assumed).

See `docs/roadmap.md` for the full architecture decisions and phased build plan.

## Stack

- SvelteKit (TypeScript, Svelte 5 in runes mode), `@sveltejs/adapter-node`
- Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)
- Drizzle ORM + `postgres-js` driver, Postgres 17 (alpine) via Docker Compose
- pdfkit for server-side PDF export

## Commands

- `npm run dev` — start dev server
- `npm run check` — svelte-check (type/lint check) — always run before committing
- `npm run lint` / `npm run format` — Prettier check / write
- `docker compose up -d` — start Postgres
- `npm run db:generate` — generate a Drizzle migration from schema changes
- `npm run db:migrate` — apply pending migrations
- `npm run db:studio` — Drizzle Studio DB browser

Never use `npm run db:push` — it requires an interactive TTY and fails non-interactively.
Always use the `db:generate` + `db:migrate` workflow.

## Architecture notes

- All mutations go through SvelteKit form actions (`+page.server.ts`) with
  progressive enhancement (`use:enhance`) — no separate REST API layer for the UI.
  `+server.ts` routes are only used for non-HTML responses (CSV/PDF downloads).
- Money is stored as integer cents (`hourlyRateCents`, `totalGrossCents`) to avoid
  floating-point errors.
- Wage rates are historized: a job's hourly rate can change over time
  (`wageRates` table). The applicable rate for a time entry is the latest
  `validFrom` ≤ the entry's start time. A job's first wage rate is inserted with
  `validFrom = epoch (RETROACTIVE_DATE)` so backdated manual entries created before
  the job itself still resolve to a rate.
- Single-user settings are stored in a singleton `settings` row (`id` always `1`),
  upserted via `onConflictDoUpdate`.
- Shared date-boundary helpers (`startOfWeek`, `startOfDay`, `startOfMonth`, etc.)
  live in `src/lib/date.ts` — reused by the dashboard, overview, and stats routes.
- DB access is centralized in `src/lib/server/db/queries.ts`; routes call into it
  rather than building queries inline.

## Workflow

- Work with git commits at logical checkpoints, not just at the end.
- Browser-test UI changes (Playwright) in addition to `npm run check` — type
  checking does not catch logic bugs (e.g. the wage-retroactivity bug and the
  stats chart flexbox bug were only caught by rendering the app).
