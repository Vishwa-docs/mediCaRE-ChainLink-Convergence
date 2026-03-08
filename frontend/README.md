# mediCaRE — Frontend

Next.js 16.1.6 / React 19 application providing the patient, provider, and admin interface for the mediCaRE platform.

## Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **TailwindCSS v4** — utility-first styling
- **thirdweb v5** — wallet connection & contract interaction
- **Recharts** — analytics charts
- **Lucide React** — icons

## Pages (16 Routes)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Hero + feature cards |
| `/dashboard` | Dashboard | Real-time KPIs from contracts |
| `/records` | Records | EHR viewing & encrypted upload |
| `/visit-summary` | Visit Summary | AI pre/post visit summarization |
| `/insurance` | Insurance | Policy management & claims |
| `/supply-chain` | Supply Chain | Batch tracking & IoT conditions |
| `/credentials` | Credentials | Provider credential management |
| `/governance` | Governance | Proposals, voting, execution |
| `/audit-log` | Audit Log | On-chain event viewer (5 contracts) |
| `/contract-health` | Contract Health | Deployment status & entity counts |
| `/analytics` | Analytics | Charts, KPIs, claim breakdowns |
| `/settings` | Settings | World ID & wallet configuration |
| `/mini-app` | Mini App | World App–ready interface |

## Setup

```bash
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001' > .env.local
npm run dev     # http://localhost:3000
```

## Build

```bash
npx next build
```

All pages read **real on-chain data** — zero mock data.
