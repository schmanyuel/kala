default:
    @just --list

# Postgres im Hintergrund starten
db-up:
    docker compose up -d

# Migration aus Schema-Änderungen erzeugen
db-generate:
    npm run db:generate

# Ausstehende Migrationen anwenden (startet vorher die DB)
db-migrate: db-up
    npm run db:migrate

# Drizzle Studio
db-studio:
    npm run db:studio

dev: db-migrate
    npm run dev

check:
    npm run check

backup:
    cd docker/ && docker compose exec -T pg pg_dumpall -U postgres > ../kala.sql

deploy: check
    git pull && cd docker/ && docker compose up -d --build
