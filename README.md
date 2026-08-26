# Ninja Wallet

A self-custody crypto wallet for iOS and Android, built with Expo and React
Native from the Ninja Wallet Figma design.

Keys are generated on the device, encrypted with a passcode, and stored in the
platform keychain. There is no account, no server, and no backup service.

> **This wallet has not been security-audited.** It generates real keys and
> broadcasts real transactions. It ships pointed at the Sepolia testnet on
> purpose. Do not put funds on mainnet that you are not willing to lose.

## Running it

```bash
npm install
npm start          # then scan the QR code with Expo Go
npm run ios        # or android
```

Checks:

```bash
npm test           # 54 tests, incl. BIP-39/44/84 vectors
npm run typecheck
npm run lint
```

## What works

| Area | State |
| --- | --- |
| Create wallet (BIP-39, 12 words) | Real — platform CSPRNG, checksum-valid |
| Back up and verify the phrase | Real — reveal-on-tap, three-word quiz |
| Restore from a phrase | Real — 12 or 24 words, checksum-validated |
| Passcode encryption + keychain | Real — scrypt + AES via ethers keystore |
| Biometric gate | Real — optional, falls back if unenrolled |
| Auto-lock | Real — clears the key after 2 min backgrounded |
| Ethereum balance | Real — live JSON-RPC read |
| Ethereum send | Real — gas estimate, EIP-1559, signed and broadcast |
| Bitcoin address (BIP-84, `bc1…`) | Real — derived from the same seed |
| Bitcoin balance / send | **Not implemented** — receive-only |
| Swap | **Not implemented** — screen is laid out, button disabled |
| Prices, charts, portfolio value in USD | **Not implemented** — no price feed |
| Transaction history | **Not implemented** — links out to a block explorer |

Nothing in the "not implemented" rows is faked in the UI. A balance you cannot
verify is worse than no balance, so those screens say what they cannot do.

## Security notes

Decisions worth knowing about before trusting this with anything:

- **The recovery phrase is never a render input.** It lives in a ref inside
  `WalletContext` and is reached only through `withPhrase()`, so it cannot land
  in a devtools snapshot or an error-boundary props dump. It is never passed as
  a router param either — those end up in deep-link URLs.
- **scrypt is tuned down.** ethers defaults to N=2^18, which takes minutes in
  JavaScript on a phone. `keystore.ts` uses 2^15 and leans on the hardware-backed
  keychain for the rest. A long passphrase beats a 6-digit PIN here.
- **A broken RNG aborts wallet creation.** `assertSecureRandomAvailable()` and
  the all-zero entropy check in `generateMnemonic` refuse rather than produce a
  predictable, drainable wallet.
- **Secure storage failure is not treated as "no wallet".** If the keychain
  cannot be read, the app shows an error with a retry. Falling through to
  onboarding would let a fresh keystore overwrite the existing one.
- **Public RPC endpoints are the default.** They see every address you query.
  Set `EXPO_PUBLIC_SEPOLIA_RPC_URL` / `EXPO_PUBLIC_ETHEREUM_RPC_URL` to your own
  node for anything real.

## Layout

```
app/                      expo-router routes
  index.tsx               entry gate: onboarding / unlock / wallet
  (onboarding)/           welcome, create, backup, verify, passcode, restore, unlock
  (wallet)/               tabs: portfolio, swap, settings
  coin/[symbol].tsx       asset detail
  send/[symbol].tsx       transfer: compose, review the real fee, sign, broadcast
  receive/[symbol].tsx    QR + address
src/
  theme/                  design tokens read out of the Figma file
  components/             Button, Card, CoinRow, CoinIcon, TextField, …
  wallet/                 mnemonic, derivation, keystore, chain, context
```

## Design fidelity

Built from Figma file `YNkaMjKBBi046LgXOj3VIJ`, section
*orange-2.0 Update 8-29-2024*. Colours, type scale, radii and spacing are read
from the file's variables and node properties — see the `figma:` comments in
`src/theme/index.ts`.

The logo is the real artwork, machine-traced: `assets/logo-source.png` →
`scripts/trace-logo.py` (potrace) → the path data in
`src/components/NinjaLogo.tsx`. Re-run the script if the artwork changes:

```bash
pip install pillow numpy potracer
python3 scripts/trace-logo.py assets/logo-source.png ./out
```

One gap remains, because the build environment's network policy blocks
`figma.com` and the file's exported assets could not be downloaded:

- **Coin icons are redrawn or monogrammed.** Bitcoin and Ethereum use their
  published brand geometry; other coins fall back to a branded initial.

The design's screens for buy, sell, staking, NFTs, referrals, and support are
not built — this is the onboarding and core-wallet slice.
