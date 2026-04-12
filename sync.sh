#!/usr/bin/env bash
# sync.sh — Sync open-source folder from main AISheeter codebase
#
# Usage: ./sync.sh
#
# Frontend: FULL copy (all files). The intelligence is server-side.
# Backend: WHITELIST only. New files excluded by default.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OSS_DIR="$SCRIPT_DIR"

FRONTEND_SRC="$ROOT_DIR/ai-sheet-front-end"
BACKEND_SRC="$ROOT_DIR/ai-sheet-backend"
FRONTEND_DST="$OSS_DIR/frontend"
BACKEND_DST="$OSS_DIR/backend"

echo "=== AISheeter Open Source Sync ==="
echo "Source: $ROOT_DIR"
echo "Target: $OSS_DIR"
echo ""

# ─── FRONTEND: Full copy ────────────────────────────────────────────
echo "[1/3] Syncing frontend (full copy)..."

rm -rf "$FRONTEND_DST"
mkdir -p "$FRONTEND_DST"

rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  "$FRONTEND_SRC/" "$FRONTEND_DST/"

# Sanitize .clasp.json — replace real scriptId with placeholder
if [ -f "$FRONTEND_DST/.clasp.json" ]; then
  cat > "$FRONTEND_DST/.clasp.json" << 'CLASP_EOF'
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "."
}
CLASP_EOF
  echo "  -> .clasp.json sanitized (scriptId replaced)"
fi

echo "  -> Frontend synced ($(find "$FRONTEND_DST" -type f | wc -l | tr -d ' ') files)"

# ─── BACKEND: Whitelist copy ────────────────────────────────────────
echo ""
echo "[2/3] Syncing backend (whitelist)..."

# Preserve hand-written files that aren't synced from source
TMPDIR_PRESERVE=$(mktemp -d)
for f in .env.example package.json README.md; do
  if [ -f "$BACKEND_DST/$f" ]; then
    cp "$BACKEND_DST/$f" "$TMPDIR_PRESERVE/$f"
  fi
done

rm -rf "$BACKEND_DST/src"
mkdir -p "$BACKEND_DST/src"

# --- Config files (root) ---
CONFIG_FILES=(
  "tsconfig.json"
  "next.config.mjs"
  "postcss.config.js"
  "vitest.config.ts"
  ".eslintrc.json"
  ".gitignore"
  "components.json"
  "sentry.client.config.ts"
  "sentry.server.config.ts"
  "sentry.edge.config.ts"
)

for f in "${CONFIG_FILES[@]}"; do
  if [ -f "$BACKEND_SRC/$f" ]; then
    cp "$BACKEND_SRC/$f" "$BACKEND_DST/$f"
  fi
done

# --- App shell (layout, styles, metadata) ---
APP_FILES=(
  "src/app/layout.tsx"
  "src/app/globals.css"
  "src/app/fonts.ts"
  "src/app/robots.ts"
  "src/app/sitemap.ts"
  "src/app/browserconfig.xml"
  "src/app/manifest.json"
  "src/app/site.webmanifest"
  "src/instrumentation.ts"
  "src/proxy.ts"
  "src/styles/globals.css"
)

for f in "${APP_FILES[@]}"; do
  if [ -f "$BACKEND_SRC/$f" ]; then
    mkdir -p "$BACKEND_DST/$(dirname "$f")"
    cp "$BACKEND_SRC/$f" "$BACKEND_DST/$f"
  fi
done

# --- Library files (core utilities, NOT agent intelligence) ---
LIB_FILES=(
  "src/lib/db.ts"
  "src/lib/logger.ts"
  "src/lib/utils.ts"
  "src/lib/ai/models.ts"
  "src/lib/ai/model-registry.ts"
  "src/lib/auth/auth-service.ts"
  "src/lib/auth/gating.ts"
  "src/lib/security/cors.ts"
  "src/lib/security/rate-limit.ts"
  "src/lib/security/validation.ts"
  "src/lib/stripe/index.ts"
  "src/lib/managed-ai/index.ts"
  "src/lib/prompts/index.ts"
  "src/lib/cache/index.ts"
  "src/utils/encryption.ts"
)

for f in "${LIB_FILES[@]}"; do
  if [ -f "$BACKEND_SRC/$f" ]; then
    mkdir -p "$BACKEND_DST/$(dirname "$f")"
    cp "$BACKEND_SRC/$f" "$BACKEND_DST/$f"
  fi
done

# --- API routes (basic query + user management + payments, NO agent/jobs) ---
API_ROUTES=(
  "src/app/api/query/route.ts"
  "src/app/api/models/route.ts"
  "src/app/api/get-or-create-user/route.ts"
  "src/app/api/get-user-settings/route.ts"
  "src/app/api/save-all-settings/route.ts"
  "src/app/api/save-api-key/route.ts"
  "src/app/api/save-default-model/route.ts"
  "src/app/api/prompts/route.ts"
  "src/app/api/contact/route.ts"
  "src/app/api/join-waitlist/route.ts"
  "src/app/api/generate-image/route.ts"
  "src/app/api/stripe/checkout/route.ts"
  "src/app/api/stripe/webhook/route.ts"
  "src/app/api/stripe/portal/route.ts"
  "src/app/api/usage/check/route.ts"
  "src/app/api/test/route.ts"
)

for f in "${API_ROUTES[@]}"; do
  if [ -f "$BACKEND_SRC/$f" ]; then
    mkdir -p "$BACKEND_DST/$(dirname "$f")"
    cp "$BACKEND_SRC/$f" "$BACKEND_DST/$f"
  fi
done

# --- Landing page components ---
if [ -d "$BACKEND_SRC/src/components" ]; then
  mkdir -p "$BACKEND_DST/src/components"
  rsync -a "$BACKEND_SRC/src/components/" "$BACKEND_DST/src/components/"
fi

# --- Pages (legacy routes) ---
if [ -d "$BACKEND_SRC/src/pages" ]; then
  mkdir -p "$BACKEND_DST/src/pages"
  rsync -a "$BACKEND_SRC/src/pages/" "$BACKEND_DST/src/pages/"
fi

# --- Public assets ---
if [ -d "$BACKEND_SRC/public" ]; then
  rsync -a "$BACKEND_SRC/public/" "$BACKEND_DST/public/"
fi

# --- Database migrations (core only) ---
MIGRATION_FILES=(
  "supabase/migrations/001_core_tables.sql"
)

for f in "${MIGRATION_FILES[@]}"; do
  if [ -f "$BACKEND_SRC/$f" ]; then
    mkdir -p "$BACKEND_DST/$(dirname "$f")"
    cp "$BACKEND_SRC/$f" "$BACKEND_DST/$f"
  fi
done

# Also copy scripts/migrations if core tables exist there
if [ -d "$BACKEND_SRC/scripts/migrations" ]; then
  mkdir -p "$BACKEND_DST/scripts/migrations"
  for f in "$BACKEND_SRC/scripts/migrations/001_core_tables"*; do
    [ -f "$f" ] && cp "$f" "$BACKEND_DST/scripts/migrations/"
  done
fi

# Restore preserved files
for f in .env.example package.json README.md; do
  if [ -f "$TMPDIR_PRESERVE/$f" ]; then
    cp "$TMPDIR_PRESERVE/$f" "$BACKEND_DST/$f"
  fi
done
rm -rf "$TMPDIR_PRESERVE"

echo "  -> Backend synced ($(find "$BACKEND_DST/src" -type f | wc -l | tr -d ' ') source files)"

# ─── Strip proprietary markers ──────────────────────────────────────
echo ""
echo "[3/3] Cleaning proprietary markers..."

# Remove lines containing "// PROPRIETARY:" from all synced source files
find "$OSS_DIR/backend/src" "$OSS_DIR/frontend" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.gs' -o -name '*.html' \) 2>/dev/null | while read -r file; do
  if grep -q '// PROPRIETARY:' "$file" 2>/dev/null; then
    sed -i '' '/\/\/ PROPRIETARY:/d' "$file"
    echo "  -> Stripped markers from $(basename "$file")"
  fi
done

echo ""
echo "=== Sync complete ==="
echo "Frontend: $FRONTEND_DST"
echo "Backend:  $BACKEND_DST"
echo ""
echo "NOT included (proprietary):"
echo "  - src/lib/agents/     (SDK agent, skill injection, tools)"
echo "  - src/lib/skills/     (10 skill definitions, registry)"
echo "  - src/lib/intent/     (intent classification, embedding cache)"
echo "  - src/lib/workflow-*/  (memory, learning systems)"
echo "  - src/lib/memory/     (auto-memorizer)"
echo "  - src/lib/response/   (response normalization)"
echo "  - src/lib/prompts/    (prompt engineering)"
echo "  - src/lib/cache/      (smart caching)"
echo "  - src/app/api/agent/  (14 agent API routes)"
echo "  - src/app/api/jobs/   (async bulk pipeline)"
echo "  - src/app/api/admin/  (admin tools)"
