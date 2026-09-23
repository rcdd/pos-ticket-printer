#!/bin/bash
# Runs INSIDE the webhook container when GitHub calls it on "release published".
# Checks out the exact released tag and rebuilds/restarts the demo stack.
set -euo pipefail

REPO_DIR="/repo"
TAG="${RELEASE_TAG:?missing RELEASE_TAG env var (set by hooks.json from the payload)}"

echo "[deploy] Release published: $TAG"
cd "$REPO_DIR"
git fetch --tags origin
git checkout "$TAG"
docker compose -f docker-compose.services.yaml up -d --build
echo "[deploy] Done: $TAG is live."
