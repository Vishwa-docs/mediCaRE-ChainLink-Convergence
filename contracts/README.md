# mediCaRE — Smart Contracts

Solidity 0.8.28 contracts deployed on Tenderly Virtual Sepolia (chainId `99911155111`).

## Contracts

| Contract | Purpose | Token | Tests |
|----------|---------|-------|-------|
| `EHRStorage.sol` | Health record management with consent | — | 52 |
| `InsurancePolicy.sol` | Insurance NFT policies + claims | ERC-721 | 50 |
| `SupplyChain.sol` | Pharmaceutical batch tracking | ERC-1155 | 46 |
| `CredentialRegistry.sol` | Provider credentialing | — | 35 |
| `Governance.sol` | DAO proposals & voting | ERC-20 | 31 |
| `AccessManager.sol` | World ID + consent control | — | — |
| `MockStablecoin.sol` | Test token for insurance | ERC-20 | — |

## Architecture

- **AccessManager** — Shared access control with World ID verification (`IWorldIDVerifier`)
- **ReentrancyGuard** — Protection against re-entrancy attacks
- **OpenZeppelin 5.6.1** — ERC-721, ERC-1155, ERC-20 implementations

## Gas Optimizations

- Solidity optimizer enabled (`viaIR: true`, 200 runs, Cancun EVM)
- `unchecked` counter increments on all entity ID counters
- Custom errors replacing string `require` messages in SupplyChain
- Internal helper `_isSupplyChainActor()` reducing bytecode size

## Setup

```bash
npm install
npx hardhat compile
npx hardhat test          # 214 tests
```

## Deployment

```bash
npx hardhat run scripts/deploy.ts --network tenderlyVNet
npx hardhat run scripts/seed_data.ts --network tenderlyVNet
```

## Deployed Addresses

| Contract | Address |
|----------|---------|
| MockStablecoin | `0x7Cf6cb620c2617887DC0Df5Faf8b14A984404f98` |
| EHRStorage | `0xd3269fe5e7C03B505bB73d5B3ec5655B72DeFE00` |
| InsurancePolicy | `0x960C6b7bA344ed26EFe7CeB9D878E11a465977d1` |
| SupplyChain | `0xC69B9c117bA7207ae7c28796718e950fD2eE3507` |
| CredentialRegistry | `0x57Df5458eDC1Cc1eD6F08D7eC3e3f9b170448a9A` |
| Governance | `0xB5095Ecbf55E739395e346A6ebEA1701D47d5556` |
