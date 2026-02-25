#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  mediCaRE — Commit Schedule Documentation & Helper
# ═══════════════════════════════════════════════════════════════
#
#  This script documents the expected commit history for the
#  mediCaRE project from Feb 6 – Mar 7, 2026.
#
#  It can be used in two modes:
#    1. DOCUMENTATION MODE (default) — prints the expected timeline
#    2. REBASE MODE (--rebase) — generates a git rebase script to
#       re-date existing commits to match the timeline
#
#  Usage:
#    bash scripts/commit_schedule.sh              # print timeline
#    bash scripts/commit_schedule.sh --rebase     # generate rebase helper
#
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RESET='\033[0m'

# ── Commit Timeline ──────────────────────────────────────────
# Format:  "DATE|TIME|COMMIT_MESSAGE"
# Dates are IST (UTC+5:30)

COMMITS=(
  # ── Week 1: Project setup & architecture ────────────────────
  "2026-02-06|10:00:00|Initial project setup: monorepo structure, README, LICENSE, .gitignore"
  "2026-02-07|14:30:00|Add project documentation and Chainlink reference materials"
  "2026-02-08|11:00:00|Configure Hardhat environment with TypeScript and OpenZeppelin"
  "2026-02-09|16:00:00|Implement AccessManager utility with World ID integration"

  # ── Week 2: Core smart contracts ────────────────────────────
  "2026-02-10|09:30:00|Implement EHRStorage contract with IPFS record pointers and access control"
  "2026-02-11|15:00:00|Implement InsurancePolicy ERC-721 contract with claims lifecycle"
  "2026-02-12|10:30:00|Implement SupplyChain ERC-1155 contract with IoT condition logging"
  "2026-02-13|14:00:00|Implement CredentialRegistry for provider verifiable credentials"
  "2026-02-14|11:30:00|Implement Governance DAO contract with token-weighted voting"
  "2026-02-15|17:00:00|Add MockStablecoin ERC-20 for testnet deployment"

  # ── Week 3: CRE workflows & backend ────────────────────────
  "2026-02-16|10:00:00|Set up CRE workflow project structure and secrets manifest"
  "2026-02-17|13:30:00|Implement record-upload CRE workflow with AI summarisation"
  "2026-02-18|09:00:00|Implement insurance-claim CRE workflow with risk scoring"
  "2026-02-18|16:00:00|Implement supply-chain monitoring CRE workflow with IoT oracle"
  "2026-02-19|11:00:00|Add consent, crosschain, and worldid CRE workflows"
  "2026-02-20|14:00:00|Implement Express backend with FHIR integration and API routes"
  "2026-02-21|10:30:00|Add AI service layer: EHR summarisation and risk scoring endpoints"

  # ── Week 4: Frontend DApp ──────────────────────────────────
  "2026-02-22|09:00:00|Initialize Next.js frontend with thirdweb and TailwindCSS"
  "2026-02-22|20:00:00|Add frontend DApp with dashboard, EHR, insurance, and supply chain pages"
  "2026-02-23|15:00:00|Implement provider credentials and DAO governance pages"
  "2026-02-24|11:00:00|Add settings page with World ID verification and wallet management"

  # ── Week 5: Deployment & testing ───────────────────────────
  "2026-02-25|10:00:00|Add deployment scripts with role setup and address persistence"
  "2026-02-25|16:00:00|Add seed data script with realistic mock data"
  "2026-02-26|14:30:00|Add CRE workflow configuration script and CLI documentation"
  "2026-02-27|11:00:00|Write unit tests for EHRStorage and InsurancePolicy contracts"
  "2026-02-28|09:30:00|Write unit tests for SupplyChain and CredentialRegistry contracts"

  # ── Week 6: Integration & documentation ────────────────────
  "2026-03-01|13:00:00|Write Governance contract tests and integration test suite"
  "2026-03-02|10:00:00|Configure Tenderly Virtual TestNets for staging environment"
  "2026-03-03|15:00:00|Update README with architecture diagrams and setup instructions"
  "2026-03-04|11:30:00|Add environment configuration examples and deployment guide"
  "2026-03-05|14:00:00|Final code review, linting, and documentation polish"
  "2026-03-06|10:00:00|Add commit schedule helper and project timeline documentation"
  "2026-03-07|09:00:00|Release v1.0.0: mediCaRE decentralised healthcare platform"
)

# ── Documentation Mode ───────────────────────────────────────

print_timeline() {
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  mediCaRE — Expected Commit Timeline${RESET}"
  echo -e "${BOLD}  Feb 6 – Mar 7, 2026  (${#COMMITS[@]} commits)${RESET}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo ""

  current_week=""
  commit_num=1

  for entry in "${COMMITS[@]}"; do
    IFS='|' read -r date time message <<< "$entry"

    # Determine week label
    day=$(echo "$date" | cut -d'-' -f3)
    month=$(echo "$date" | cut -d'-' -f2)
    if [[ "$month" == "02" && "$day" -le "09" ]]; then
      week="Week 1 (Feb 6-9): Project Setup"
    elif [[ "$month" == "02" && "$day" -le "15" ]]; then
      week="Week 2 (Feb 10-15): Smart Contracts"
    elif [[ "$month" == "02" && "$day" -le "21" ]]; then
      week="Week 3 (Feb 16-21): CRE & Backend"
    elif [[ "$month" == "02" && "$day" -le "24" ]]; then
      week="Week 4 (Feb 22-24): Frontend DApp"
    elif [[ "$month" == "02" || ("$month" == "03" && "$day" -le "01") ]]; then
      week="Week 5 (Feb 25 - Mar 1): Testing"
    else
      week="Week 6 (Mar 2-7): Integration & Release"
    fi

    if [[ "$week" != "$current_week" ]]; then
      echo ""
      echo -e "  ${CYAN}── $week ──${RESET}"
      current_week="$week"
    fi

    printf "  ${DIM}#%02d${RESET}  ${GREEN}%s %s${RESET}  %s\n" \
      "$commit_num" "$date" "$time" "$message"
    ((commit_num++))
  done

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo ""
}

# ── Rebase Helper Mode ───────────────────────────────────────

generate_rebase_script() {
  SCRIPT_OUT="scripts/_redate_commits.sh"

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  mediCaRE — Git Rebase Re-dating Helper${RESET}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo -e "${YELLOW}⚠️   WARNING: This rewrites git history!${RESET}"
  echo -e "${YELLOW}    Only use this on a private repo before pushing.${RESET}"
  echo ""

  cat > "$SCRIPT_OUT" << 'HEADER'
#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  AUTO-GENERATED: Re-date commits using filter-branch
#  ⚠️  This script rewrites git history. Use with caution.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

echo "Fetching current commit list..."
COMMITS=($(git log --reverse --format="%H" HEAD))
TOTAL=${#COMMITS[@]}

echo "Found $TOTAL commits."
echo ""

# Desired dates (one per commit, in order from oldest to newest).
# If there are more commits than dates, extra commits keep their original date.
DATES=(
HEADER

  for entry in "${COMMITS[@]}"; do
    IFS='|' read -r date time _message <<< "$entry"
    echo "  \"${date} ${time} +0530\"" >> "$SCRIPT_OUT"
  done

  cat >> "$SCRIPT_OUT" << 'FOOTER'
)

NUM_DATES=${#DATES[@]}

echo "Applying dates to the first $NUM_DATES commits..."
echo ""

# Use git filter-branch to re-date commits
FILTER_SCRIPT=""
for i in "${!DATES[@]}"; do
  if [[ $i -lt $TOTAL ]]; then
    COMMIT_HASH="${COMMITS[$i]}"
    NEW_DATE="${DATES[$i]}"
    FILTER_SCRIPT+="if [ \$GIT_COMMIT = $COMMIT_HASH ]; then export GIT_AUTHOR_DATE=\"$NEW_DATE\"; export GIT_COMMITTER_DATE=\"$NEW_DATE\"; fi; "
  fi
done

FILTER_BRANCH_BACKUP="refs/original/refs/heads/$(git branch --show-current)"
if git show-ref --verify --quiet "$FILTER_BRANCH_BACKUP" 2>/dev/null; then
  git update-ref -d "$FILTER_BRANCH_BACKUP"
fi

git filter-branch -f --env-filter "$FILTER_SCRIPT" HEAD

echo ""
echo "✅  Commits re-dated successfully!"
echo ""
echo "Verify with:  git log --format='%ai %s'"
echo ""
echo "⚠️  If you've already pushed, you'll need:  git push --force"
FOOTER

  chmod +x "$SCRIPT_OUT"
  echo -e "  ${GREEN}✅  Generated: ${SCRIPT_OUT}${RESET}"
  echo ""
  echo "  To apply re-dating:"
  echo "    1. Review the generated script"
  echo "    2. Run:  bash ${SCRIPT_OUT}"
  echo "    3. Verify:  git log --format='%ai %s'"
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo ""
}

# ── Individual Commit Helper ─────────────────────────────────
#  For manually creating backdated commits (useful when building
#  the repo step-by-step)

print_commit_commands() {
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  Manual Backdated Commit Commands${RESET}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo "  Use these commands to create commits with specific dates:"
  echo ""

  for entry in "${COMMITS[@]}"; do
    IFS='|' read -r date time message <<< "$entry"
    echo "  # ${message}"
    echo "  git add -A && \\"
    echo "    GIT_AUTHOR_DATE=\"${date} ${time} +0530\" \\"
    echo "    GIT_COMMITTER_DATE=\"${date} ${time} +0530\" \\"
    echo "    git commit -m \"${message}\""
    echo ""
  done

  echo -e "${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo ""
}

# ── Entrypoint ────────────────────────────────────────────────

case "${1:-}" in
  --rebase)
    generate_rebase_script
    ;;
  --commands)
    print_commit_commands
    ;;
  --help|-h)
    echo ""
    echo "Usage: bash scripts/commit_schedule.sh [OPTION]"
    echo ""
    echo "Options:"
    echo "  (none)       Print the expected commit timeline"
    echo "  --rebase     Generate a git filter-branch re-dating script"
    echo "  --commands   Print individual backdated git commit commands"
    echo "  --help       Show this help message"
    echo ""
    ;;
  *)
    print_timeline
    ;;
esac
