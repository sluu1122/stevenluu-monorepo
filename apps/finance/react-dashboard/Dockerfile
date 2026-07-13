# syntax=docker/dockerfile:1
# Build context: repo root. Build with:
#   docker buildx build --platform linux/amd64 -f apps/finance/react-dashboard/Dockerfile -t ghcr.io/sluu123/react-dashboard:latest .
FROM node:24-slim AS base

FROM base AS pruner
WORKDIR /repo
RUN npm install -g turbo@2.9.16
COPY . .
# react-dashboard's vite.config.ts aliases @repo/ui and @repo/resume-data to their
# *source* directories, not built output — `turbo prune` brings in the full source
# of both as transitive workspace dependencies, which is what makes this buildable
# from a repo-root context in the first place.
RUN turbo prune react-dashboard --docker

FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/.npmrc .npmrc
RUN npm ci --legacy-peer-deps

COPY --from=pruner /repo/out/full/ .
RUN npx turbo run build --filter=react-dashboard

FROM nginx:alpine AS runtime
COPY --from=installer /repo/apps/finance/react-dashboard/dist /usr/share/nginx/html
COPY apps/finance/react-dashboard/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
