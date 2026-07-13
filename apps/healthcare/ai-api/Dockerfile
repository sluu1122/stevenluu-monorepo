# syntax=docker/dockerfile:1
# Build context: repo root. Build with:
#   docker buildx build --platform linux/amd64 -f apps/healthcare/ai-api/Dockerfile -t ghcr.io/sluu123/ai-api:latest .
FROM node:24-slim AS base

# ---- prune: compute the minimal subset of the workspace this app actually needs ----
FROM base AS pruner
WORKDIR /repo
RUN npm install -g turbo@2.9.16
COPY . .
RUN turbo prune ai-api --docker

# ---- deps: install once, cached by the pruned lockfile/manifests only ----
FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/.npmrc .npmrc
# --ignore-scripts: ai-api's own postinstall runs `ollama pull ...`, which assumes a
# local Ollama daemon that doesn't exist at build time — Ollama connectivity is wired
# up purely at container runtime via OLLAMA_URL (see docker-compose.yml), never here.
RUN npm ci --legacy-peer-deps --ignore-scripts

# ---- build: bring in real source, compile via turbo ----
COPY --from=pruner /repo/out/full/ .
RUN npx turbo run build --filter=ai-api

# ---- runtime: slim, no build tooling ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /repo/apps/healthcare/ai-api/dist ./dist
COPY --from=installer /repo/apps/healthcare/ai-api/package.json ./package.json
COPY --from=installer /repo/node_modules ./node_modules
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
