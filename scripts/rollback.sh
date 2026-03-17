#!/usr/bin/env bash
# Rollback: deploy a previous git commit to the server.
# Usage: ./scripts/rollback.sh <git-sha>
# Requires: SSH key at infra/<project>-<env>.pem, EC2 host known (or set EC2_HOST env).
set -e

SHA="${1:?Usage: $0 <git-sha>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Optional: set these if not using default
EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/opt/app}"
KEY_PATH="${KEY_PATH:-$REPO_ROOT/infra/deployment-demo-dev.pem}"

if [ -z "$EC2_HOST" ]; then
  echo "Set EC2_HOST (e.g. export EC2_HOST=1.2.3.4) or pass as second arg"
  exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
  echo "SSH key not found at $KEY_PATH"
  exit 1
fi

echo "Rolling back to commit: $SHA"
git fetch --all 2>/dev/null || true
git checkout "$SHA" -- .

scp -i "$KEY_PATH" -r ./app "$EC2_USER@$EC2_HOST:$APP_DIR/"
scp -i "$KEY_PATH" -r ./deploy "$EC2_USER@$EC2_HOST:$APP_DIR/"

GIT_SHORT=$(git rev-parse --short HEAD)
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_HOST" bash -c "
  set -e
  export GIT_SHA=$GIT_SHORT
  cd $APP_DIR/deploy
  docker compose down || true
  docker compose build --no-cache
  GIT_SHA=$GIT_SHORT docker compose up -d
  echo Waiting for containers...
  sleep 10
  curl -sf http://localhost/health && echo ' Health OK' || exit 1
  curl -s http://localhost/version
"

echo "Rollback to $GIT_SHORT completed."
git checkout - -- . 2>/dev/null || true
