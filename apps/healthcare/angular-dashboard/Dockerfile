# syntax=docker/dockerfile:1
# Build context: repo root. Build with:
#   docker buildx build --platform linux/amd64 -f apps/healthcare/angular-dashboard/Dockerfile -t ghcr.io/sluu123/angular-dashboard:latest .
FROM node:24-slim AS base

FROM base AS pruner
WORKDIR /repo
RUN npm install -g turbo@2.9.16
COPY . .
RUN turbo prune angular-dashboard --docker

FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/.npmrc .npmrc
RUN npm ci --legacy-peer-deps

COPY --from=pruner /repo/out/full/ .
RUN npx turbo run build --filter=angular-dashboard

# ---- runtime: static SPA served by nginx, with runtime-config injection ----
FROM nginx:alpine AS runtime
COPY --from=installer /repo/apps/healthcare/angular-dashboard/dist/angular-dashboard/browser /usr/share/nginx/html
COPY apps/healthcare/angular-dashboard/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/healthcare/angular-dashboard/docker/entrypoint.sh /docker-entrypoint.d/40-render-env.sh
RUN chmod +x /docker-entrypoint.d/40-render-env.sh
EXPOSE 80
