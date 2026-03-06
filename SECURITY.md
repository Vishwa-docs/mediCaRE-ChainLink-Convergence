# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The mediCaRE team takes security seriously.  If you discover a vulnerability
in the smart contracts, backend, or frontend, **please report it responsibly**
rather than opening a public issue.

### How to Report

1. **Email:** Send a detailed description to **security@medicare.dao**
   (monitored 24/7).
2. **Subject line:** `[SECURITY] <brief summary>`
3. **Include:**
   - A description of the vulnerability and its potential impact.
   - Steps to reproduce or a proof-of-concept (PoC).
   - The affected component(s): contracts, backend, frontend, or infra.
   - Your contact information for follow-up.

### PGP Key

If you prefer encrypted communication, use the PGP key published at:  
`https://medicare.dao/.well-known/security-pgp-key.asc`

### What to Expect

| Stage | Timeline |
|-------|----------|
| Acknowledgement | Within **24 hours** of report |
| Initial triage & severity assessment | Within **72 hours** |
| Patch development & internal review | Within **14 days** for critical/high |
| Public disclosure (coordinated) | After fix is deployed |

We follow a **90-day coordinated disclosure** policy.  If we cannot patch
within 90 days, we will work with you to agree on a disclosure timeline.

### Scope

The following are **in scope**:

- Smart contracts in `contracts/src/`
- Backend API in `backend/src/`
- Frontend application in `frontend/src/`
- CRE workflow definitions in `cre-workflows/`
- CI/CD configurations in `.github/workflows/`
- Deployment scripts in `scripts/`

The following are **out of scope**:

- Third-party dependencies (report upstream; let us know so we can update).
- Social engineering attacks against team members.
- Denial of service against public testnets.

### Bug Bounty

We intend to launch a formal bug bounty programme on [Immunefi](https://immunefi.com)
post-mainnet. In the meantime, significant findings will be rewarded at our
discretion.

## Security Best Practices (for contributors)

1. **Never commit secrets.** All keys and credentials must go in `.env`
   (git-ignored).  Use the `.env.example` template.
2. **Use OpenZeppelin contracts** for standard security patterns
   (AccessControl, ReentrancyGuard, SafeERC20).
3. **Follow the checks–effects–interactions pattern** in all state-mutating
   functions.
4. **Validate all external inputs** (zero-address checks, bounds checks,
   overflow-safe arithmetic).
5. **Emit events before external calls** where possible (optimistic logging).
6. **Pin dependency versions** (lock files must be committed).
7. **Run the full test suite** (`npx hardhat test`) before submitting a PR.
8. **Review gas reports** to guard against gas-griefing vectors.

## Audit Status

| Audit Firm | Scope | Date | Status |
|------------|-------|------|--------|
| *Pending* | All contracts | TBD | Planned |

## Contact

For non-security questions, open a GitHub issue or reach out via the project's
discussion channels.
