# syntax=docker/dockerfile:1
# Build context: repo root. Build with:
#   docker buildx build --platform linux/amd64 -f apps/healthcare/patients-api/Dockerfile -t ghcr.io/sluu1122/patients-api:latest .
FROM node:24-slim AS base

FROM base AS pruner
WORKDIR /repo
RUN npm install -g turbo@2.9.16
COPY . .
RUN turbo prune patients-api --docker

FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/.npmrc .npmrc
RUN npm ci --legacy-peer-deps

COPY --from=pruner /repo/out/full/ .
RUN npx turbo run build --filter=patients-api

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /repo/apps/healthcare/patients-api/dist ./dist
COPY --from=installer /repo/apps/healthcare/patients-api/package.json ./package.json
COPY --from=installer /repo/node_modules ./node_modules
EXPOSE 3004
USER node
CMD ["node", "dist/index.js"]
