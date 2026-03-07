# mediCaRE DApp — Complete Setup Guide

A beginner-friendly, step-by-step guide to getting all the API keys, wallets, and credentials needed to deploy and run the mediCaRE DApp.

---

## Table of Contents

1. [MetaMask Wallet Setup](#1-metamask-wallet-setup)
2. [Alchemy RPC URL](#2-alchemy-rpc-url)
3. [Etherscan API Key](#3-etherscan-api-key)
4. [Tenderly Account & Virtual TestNet](#4-tenderly-account--virtual-testnet)
5. [Putting It All Together (.env File)](#5-putting-it-all-together-env-file)
6. [Deploying to Tenderly Virtual TestNet](#6-deploying-to-tenderly-virtual-testnet)

---

## 1. MetaMask Wallet Setup

MetaMask is a browser extension wallet that lets you interact with Ethereum and other EVM blockchains. You'll need it to sign transactions and deploy smart contracts.

### Step 1: Install MetaMask

1. Go to **https://metamask.io/download/**
2. Click the **Download** button for your browser (Chrome, Firefox, Brave, or Edge).
3. You'll be taken to the browser's extension store — click **Add to Chrome** (or equivalent).
4. Once installed, a fox icon 🦊 will appear in your browser toolbar. Click it.

### Step 2: Create a New Wallet

1. Click **Create a new wallet**.
2. Agree to the terms of use.
3. Create a **strong password** (at least 8 characters). This is for unlocking MetaMask on your device — it is NOT your private key.
4. Click **Create**.

### Step 3: Back Up Your Secret Recovery Phrase

1. MetaMask will show you a **12-word Secret Recovery Phrase** (also called "seed phrase").
2. **WRITE THIS DOWN ON PAPER** and store it in a safe place. Anyone with this phrase can access all your funds.
3. **NEVER share it** with anyone, **NEVER screenshot it**, **NEVER paste it** in any website.
4. MetaMask will ask you to confirm the phrase by selecting the words in order. Do this.

### Step 4: Get Your Wallet Address

1. After setup, you'll see your account screen with an address like `0x1234...abcd`.
2. Click on the address to **copy** it to your clipboard.
3. This is your **public wallet address** — it's safe to share (like an email address for crypto).

### Step 5: Export Your Private Key (Needed for Deployment)

1. Click the **three dots** (⋮) next to the account name.
2. Click **Account details**.
3. Click **Show private key**.
4. Enter your MetaMask password.
5. Your private key will be displayed — **copy it**.
6. **NEVER share this** with anyone. It gives full access to your wallet.
7. You'll paste this into your `.env` file later as `PRIVATE_KEY`.

### Step 6: Add a Test Network (Sepolia)

For development, you'll use the **Sepolia** test network instead of mainnet (so you don't spend real ETH).

1. In MetaMask, click the **network dropdown** at the top (it says "Ethereum Mainnet").
2. Click **Show test networks** if you don't see Sepolia.
3. Toggle on **Show test networks** in Settings > Advanced.
4. Select **Sepolia** from the dropdown.

### Step 7: Get Free Test ETH

You need test ETH (SepoliaETH) to pay for gas fees on the testnet.

1. Go to **https://sepoliafaucet.com/** (Alchemy Sepolia Faucet)
   - Alternative: **https://faucets.chain.link/sepolia** (Chainlink Faucet)
   - Alternative: **https://www.infura.io/faucet/sepolia** (Infura Faucet)
2. Paste your MetaMask wallet address.
3. Click **Send me ETH**.
4. Wait 10–30 seconds. Check MetaMask — you should see 0.5 ETH (or similar) on Sepolia.

> **Note:** When using Tenderly Virtual TestNets, you don't need real test ETH — the built-in unlimited faucet gives you as much as you need!

---

## 2. Alchemy RPC URL

Alchemy provides access to blockchain nodes. Your DApp uses Alchemy's RPC URL to communicate with Ethereum.

### Step 1: Create an Alchemy Account

1. Go to **https://dashboard.alchemy.com/signup**
2. Sign up with **Google**, **GitHub**, or **Email + Password**.
3. Verify your email if prompted.

### Step 2: Create an App

1. After logging in, you'll see the Alchemy Dashboard.
2. Click **Create new app** (or **+ Create App**).
3. Fill in:
   - **App Name**: `mediCaRE` (or any name you prefer)
   - **Description**: Optional — e.g., "Healthcare DApp"
   - **Chain**: Select **Ethereum**
   - **Network**: Select **Sepolia** (for testnet development)
4. Click **Create app**.

### Step 3: Get Your RPC URL

1. On your app card, click **View Key** (or click the app name to go to its detail page).
2. You'll see:
   - **HTTPS URL**: e.g., `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
   - **WebSocket URL**: e.g., `wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
3. Click the **copy icon** next to the HTTPS URL.
4. This is your `ALCHEMY_RPC_URL` for the `.env` file.

### Step 4: Get Your Alchemy API Key (Optional — Separate)

The API key is embedded in the URL above (the part after `/v2/`), but you can also find it:

1. In the app detail page, look for **API Key**.
2. Copy it separately if needed.

> **Free Tier:** Alchemy's free plan includes **300 million compute units/month** — more than enough for development and testing.

---

## 3. Etherscan API Key

Etherscan is a blockchain explorer. An API key lets you verify your contracts on-chain (making code publicly readable and verifiable).

### Step 1: Create an Etherscan Account

1. Go to **https://etherscan.io/register**
2. Fill in:
   - **Username**
   - **Email Address**
   - **Password** (and confirm)
3. Agree to Terms of Service.
4. Click **Create an Account**.
5. Check your email and click the **verification link**.

### Step 2: Generate an API Key

1. Log in to Etherscan at **https://etherscan.io/login**
2. Hover over your username (top right) and click **My API Keys** or go directly to:
   **https://etherscan.io/myapikey**
3. Click **+ Add** to create a new API key.
4. Enter an **App Name** (e.g., `mediCaRE`).
5. Click **Create New API Key**.
6. Your API key is now displayed — **copy it**.
7. This is your `ETHERSCAN_API_KEY` for the `.env` file.

> **Free Tier:** Etherscan's free plan allows **5 calls/second** and **100,000 calls/day** — more than enough for contract verification.

### Note on Other Networks

If you deploy to other networks, you may need API keys from their respective explorers:
- **Polygon (Amoy)**: https://polygonscan.com/register
- **Arbitrum**: https://arbiscan.io/register
- **Base**: https://basescan.org/register
- **Optimism**: https://optimistic.etherscan.io/register

---

## 4. Tenderly Account & Virtual TestNet

Tenderly provides a powerful development platform with Virtual TestNets — simulated blockchain environments with unlimited faucets, transaction debugging, and more.

### Step 1: Create a Tenderly Account

1. Go to **https://dashboard.tenderly.co/register**
2. Sign up with **GitHub**, **Google**, or **Email + Password**.
3. Complete your profile if prompted.

### Step 2: Create a Project

1. After logging in, you'll see the Tenderly Dashboard.
2. If you don't already have a project, click **Create Project**.
3. Give it a name (e.g., `mediCaRE`).
4. Note your **account slug** (username) and **project slug** — you'll need these for environment variables.

### How to Find Your Account & Project Slugs

1. Look at the URL in your browser when on the dashboard:
   `https://dashboard.tenderly.co/<account_slug>/<project_slug>`
2. The first part after `dashboard.tenderly.co/` is your **account slug**.
3. The next part is your **project slug**.

### Step 3: Generate an API Access Token

1. Click on your **profile photo** (top right).
2. Navigate to **Account Settings**.
3. Go to the **Access Tokens** tab.
   - Direct link: **https://dashboard.tenderly.co/account/authorization**
4. Click **Generate Access Token**.
5. Give it a label (e.g., `mediCaRE-deploy`).
6. Click **Generate**.
7. **COPY THE TOKEN IMMEDIATELY** — it will only be shown once!
8. This is your `TENDERLY_ACCESS_KEY` for the `.env` file.

### Step 4: Create a Virtual TestNet

1. In the Tenderly Dashboard, click **Virtual TestNets** in the left sidebar.
2. Click **Create Virtual TestNet**.
3. Fill in:
   - **Parent Network**: Select **Ethereum Sepolia** (or Ethereum Mainnet for production-like testing)
   - **Name**: e.g., `mediCaRE-dev`
   - **Chain ID**: Use a custom value like `735711155111` (or leave as parent's chain ID)
   - **Public Explorer**: Enable if you want a public-facing explorer URL
   - **State Sync**: Enable if you want real-time sync with the parent network
4. Click **Create**.

### Step 5: Copy the RPC URLs

After creation, your Virtual TestNet will have two RPC URLs:

1. **Admin RPC**: Full "god mode" access — use this for deployment and testing.
   - Supports all standard RPC + `tenderly_setBalance`, `evm_snapshot`, etc.
2. **Public RPC**: Standard RPC — use this for your dApp's frontend.

Copy the **Admin RPC URL** — this is your `TENDERLY_VIRTUAL_TESTNET_RPC` for the `.env` file.

### Step 6: Fund Your Wallet on the Virtual TestNet

1. In the Virtual TestNet dashboard, click **Faucet**.
2. Paste your MetaMask wallet address (from Step 1).
3. Enter an amount: **1000** (ETH).
4. Click **Fund**.
5. Your wallet now has 1000 test ETH on the Virtual TestNet — instantly, for free!

### Step 7: Add Virtual TestNet to MetaMask

1. In the Virtual TestNet dashboard, click **Add to Wallet**.
2. MetaMask will pop up asking to add the network — click **Approve**.
3. Click **Switch network** to start using it.

Now MetaMask shows your Virtual TestNet and the funded balance.

---

## 5. Putting It All Together (.env File)

After completing all the steps above, create a `.env` file in the `mediCaRE/contracts/` directory:

```bash
# =============================================================
#  mediCaRE — Environment Variables
# =============================================================

# --- Your MetaMask Wallet ---
PRIVATE_KEY=your_metamask_private_key_here

# --- Alchemy (RPC Provider) ---
# Only needed for real testnet deployments (not needed for Tenderly Virtual TestNet)
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY

# --- Etherscan (Contract Verification) ---
# Only needed for real testnet verification (Tenderly has its own verification)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# --- Tenderly (Virtual TestNet) ---
TENDERLY_ACCESS_KEY=your_tenderly_access_token
TENDERLY_ACCOUNT_ID=your_tenderly_username
TENDERLY_PROJECT=your_tenderly_project_slug
TENDERLY_VIRTUAL_TESTNET_RPC=https://virtual.sepolia.rpc.tenderly.co/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX

# --- Deployment Config ---
DEPLOYER_ADDRESS=your_metamask_wallet_address_0x...
```

### Quick Checklist

| Item | Where to Get It | Variable Name |
|------|----------------|---------------|
| MetaMask Private Key | MetaMask extension → Account Details → Show Private Key | `PRIVATE_KEY` |
| MetaMask Wallet Address | MetaMask extension → click to copy address | `DEPLOYER_ADDRESS` |
| Alchemy RPC URL | https://dashboard.alchemy.com → your app → View Key | `ALCHEMY_RPC_URL` |
| Etherscan API Key | https://etherscan.io/myapikey → Add → Copy | `ETHERSCAN_API_KEY` |
| Tenderly Access Key | https://dashboard.tenderly.co/account/authorization → Generate | `TENDERLY_ACCESS_KEY` |
| Tenderly Account Slug | Dashboard URL: `dashboard.tenderly.co/<slug>/...` | `TENDERLY_ACCOUNT_ID` |
| Tenderly Project Slug | Dashboard URL: `dashboard.tenderly.co/.../<slug>` | `TENDERLY_PROJECT` |
| Tenderly RPC URL | Virtual TestNets → your TestNet → copy Admin RPC | `TENDERLY_VIRTUAL_TESTNET_RPC` |

---

## 6. Deploying to Tenderly Virtual TestNet

Once you have all your credentials set up, deploying is straightforward:

### Step 1: Install Dependencies

```bash
cd mediCaRE/contracts
npm install
```

### Step 2: Compile Contracts

```bash
npx hardhat compile
```

### Step 3: Run Tests (Optional but Recommended)

```bash
npx hardhat test
```

### Step 4: Deploy

```bash
npx hardhat run scripts/deploy.ts --network virtualSepolia
```

### Step 5: Verify on Tenderly (Automatic)

If using the `@tenderly/hardhat-tenderly` plugin with `automaticVerifications: true`, your contracts are verified automatically during deployment.

### Step 6: View in Dashboard

Go to **https://dashboard.tenderly.co** → your project → **Virtual TestNets** → your TestNet → **Contracts** → **Virtual Contracts** tab.

---

## Troubleshooting

### "Nonce too high" Error
- Reset MetaMask: Settings → Advanced → **Clear activity tab data**.

### "Insufficient funds" Error
- Fund your wallet using the Tenderly Unlimited Faucet (Dashboard → Faucet).

### "Network not detected" Error
- Manually add the network in MetaMask:
  - Network Name: Your TestNet name
  - RPC URL: Your Tenderly Admin or Public RPC URL
  - Chain ID: The Chain ID you set during TestNet creation
  - Currency Symbol: ETH

### "Invalid API Key" Error
- Double-check that you copied the full API key with no extra spaces.
- Regenerate the key if needed.

---

## Security Best Practices

1. **NEVER commit `.env` files to git.** The `.gitignore` already excludes them.
2. **NEVER share your private key** or seed phrase with anyone.
3. **Use different wallets** for development/testing vs. mainnet with real funds.
4. **Rotate API keys** periodically.
5. **Use environment variables** in CI/CD instead of hardcoded values.
