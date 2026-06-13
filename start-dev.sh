#!/usr/bin/env zsh
# start-dev.sh — One-click test environment launcher
#
# Starts frontend (pnpm dev) and backend (Django runserver) concurrently.
# Press Ctrl+C to stop both.

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Stopping all services..."
  kill $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
  wait $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
  echo "All services stopped."
}

trap cleanup SIGINT SIGTERM EXIT

# ── Frontend ────────────────────────────────────────────
echo "Starting frontend (pnpm dev)..."
cd "$ROOT_DIR/frontend"
pnpm dev &
FRONTEND_PID=$!

# ── Backend ─────────────────────────────────────────────
echo "Starting backend (Django runserver)..."
cd "$ROOT_DIR/backend"
eval "$(mamba shell hook --shell zsh)" && mamba activate geomanager && python manage.py runserver &
BACKEND_PID=$!

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Dev servers starting up...          ║"
echo "║  Frontend: http://127.0.0.1:5173     ║"
echo "║  Backend:  http://127.0.0.1:8000     ║"
echo "║  Press Ctrl+C to stop                ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Wait for either process to exit
wait