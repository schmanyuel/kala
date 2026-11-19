# syntax=docker/dockerfile:1
# Build context is the repo root:  docker compose -f docker/compose.yaml build

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# The build imports server modules for analysis; postgres.js connects lazily, so a
# placeholder URL is enough here. The real one comes from compose at runtime.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build npm run build \
    && npm prune --omit=dev

FROM node:${NODE_VERSION}-alpine
WORKDIR /app
RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Europe/Berlin
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node docker/migrate.js docker/entrypoint.sh ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1:${PORT}/ || exit 1
ENTRYPOINT ["sh", "./entrypoint.sh"]
