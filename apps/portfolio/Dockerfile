# syntax=docker/dockerfile:1
# Build context: repo root. Build with:
#   docker buildx build --platform linux/amd64 -f apps/portfolio/Dockerfile \
#     --build-arg NEXT_PUBLIC_ANGULAR_SANDBOX_URL=https://angular.yourdomain.com \
#     --build-arg NEXT_PUBLIC_REACT_SANDBOX_URL=https://react.yourdomain.com \
#     -t ghcr.io/sluu1122/portfolio:latest .
FROM node:24-slim AS base

FROM base AS pruner
WORKDIR /repo
RUN npm install -g turbo@2.9.16
COPY . .
RUN turbo prune portfolio --docker

FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/.npmrc .npmrc
RUN npm ci --legacy-peer-deps

COPY --from=pruner /repo/out/full/ .
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so they must
# be Docker build-args, not runtime env vars — see apps/portfolio/app/components/SandboxSection.tsx
ARG NEXT_PUBLIC_ANGULAR_SANDBOX_URL
ARG NEXT_PUBLIC_REACT_SANDBOX_URL
ENV NEXT_PUBLIC_ANGULAR_SANDBOX_URL=$NEXT_PUBLIC_ANGULAR_SANDBOX_URL
ENV NEXT_PUBLIC_REACT_SANDBOX_URL=$NEXT_PUBLIC_REACT_SANDBOX_URL
RUN npx turbo run build --filter=portfolio

# ---- runtime: Next.js standalone output (self-contained, trimmed node_modules) ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=installer /repo/apps/portfolio/.next/standalone ./
COPY --from=installer /repo/apps/portfolio/.next/static ./apps/portfolio/.next/static
COPY --from=installer /repo/apps/portfolio/public ./apps/portfolio/public
EXPOSE 3000
USER node
CMD ["node", "apps/portfolio/server.js"]
