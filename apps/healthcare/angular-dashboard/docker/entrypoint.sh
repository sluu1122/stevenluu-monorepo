#!/bin/sh
# Runs automatically before nginx starts (nginx's official image executes every
# *.sh under /docker-entrypoint.d/). Renders the runtime API URLs into config.json
# from container env vars, so one built image works across environments without
# rebuilding — see src/app/runtime-config.ts for the client-side fetch.
set -eu

envsubst '${CPT_API_URL} ${ICD_API_URL} ${AI_API_URL} ${PATIENTS_API_URL}' \
  < /usr/share/nginx/html/assets/config.template.json \
  > /usr/share/nginx/html/assets/config.json
