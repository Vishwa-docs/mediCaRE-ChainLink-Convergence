#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  mediCaRE — Quick-start demo script
# ──────────────────────────────────────────────────────────────
#
#  Starts a local Hardhat node, deploys contracts, seeds demo
#  data, and launches both backend + frontend for a full demo.
#
#  Usage:
#    chmod +x scripts/demo.sh && ./scripts/demo.sh
#
# ──────────────────────────────────────────────────────────────

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  mediCaRE — Demo Launcher"
echo "═══════════════════════════════════════════════════════════"
echo "  Root: $ROOT_DIR"
echo ""

# ── Step 1: Hardhat node ──
echo "🔗  Starting local Hardhat node..."
cd "$ROOT_DIR/contracts"
npx hardhat node &
HARDHAT_PID=$!
sleep 4

# ── Step 2: Deploy contracts ──
echo "📦  Deploying contracts..."
npx hardhat run scripts/deploy.ts --network localhost
echo "    ✅  Contracts deployed"

# ── Step 3: Seed demo data ──
echo "🌱  Seeding demo data..."
npx hardhat run scripts/seed_data.ts --network localhost
echo "    ✅  Demo data seeded"

# ── Step 4: Backend ──
echo "🖥️   Starting backend..."
cd "$ROOT_DIR/backend"
npm run dev &
BACKEND_PID=$!
sleep 3

# ── Step 5: Frontend ──
echo "🌐  Starting frontend..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
sleep 3

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  mediCaRE is running!"
echo "═══════════════════════════════════════════════════════════"
echo "  Frontend : http://localhost:3000"
echo "  Backend  : http://localhost:3001"
echo "  Hardhat  : http://localhost:8545"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════════════════════"

# Trap cleanup
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $FRONTEND_PID $BACKEND_PID $HARDHAT_PID 2>/dev/null
  echo "Done."
  exit 0
}
trap cleanup EXIT INT TERM

# Wait for any child to exit
wait
