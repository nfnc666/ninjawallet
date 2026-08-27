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
npm test           # 123 tests, incl. BIP-39/44/84 vectors
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
| Spot prices and USD value | Real — live feed, mainnet only |
| Price charts | **Not implemented** — needs historical series |
| Transaction history | Real — Blockscout, keyless |

Nothing in the "not implemented" rows is faked in the UI. A balance you cannot
verify is worse than no balance, so those screens say what they cannot do.

## Tests

`npm test` covers three things worth calling out:

- **Derivation against the published vectors.** BIP-39 phrase generation and
  the BIP-44 / BIP-84 addresses are checked against the specs' own test
  vectors. If these ever drift, phrases created here stop restoring in other
  wallets — the worst bug this codebase can have.
- **The money path.** `chain-transfer.test.ts` runs the real quoting and
  signing logic against a fake node: the balance guard at the exact boundary
  and one wei past it, the pre-EIP-1559 gasPrice fallback, refusing to guess a
  fee when the node returns none, chain-id pinning, and that a short balance or
  a malformed recipient never reaches a broadcast.
- **The screens behind the lock.** Portfolio, send, receive and coin detail
  cannot be opened in a browser, because the wallet refuses to run without a
  device keychain. `app/__tests__/screens.test.tsx` renders them against a
  mocked wallet and asserts on visible text, so they are not shipped unseen.

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
- **Testnet balances never get a fiat figure.** Sepolia ether does not trade, so
  there is no honest dollar value for it; the card shows the coin amount and
  says the funds are not real money. A test asserts a `$` never appears there.
- **A missing price is not a price of zero.** An asset the feed did not return
  is left blank rather than defaulted, and a non-finite value is rejected before
  it can reach a balance line.
- **Third-party APIs see your addresses.** The default price and history
  endpoints are public services; every lookup tells them which addresses you
  hold. `EXPO_PUBLIC_PRICE_API_URL` and `EXPO_PUBLIC_HISTORY_API_URL` point both
  at your own instance.

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

Both brand marks are the real artwork, machine-traced. `NinjaLogo` is the mark
on its black disc; `NinjaWordmark` is the full lockup with the drawn wordmark —
use it rather than pairing the mark with a text label, since "Ninja Wallet" is
drawn type, not a system font.

`src/components/NinjaLogo.tsx` and `NinjaWordmark.tsx` are **generated**. Edit
the PNGs, not the path data:

```bash
pip install pillow numpy potracer
python3 scripts/trace-logo.py           # regenerate both components
python3 scripts/trace-logo.py --check   # fail if they are out of sync
python3 scripts/make-icons.py           # regenerate launcher/splash/favicon assets
```

Positioning note: the mark is centred on its **white block** — the wallet and
banknotes — not on all of its ink. The eye centres a mark on its visual mass,
so the orange swoosh and the sparkles count as overhang. Two other rules were
tried and rejected: the full ink bounding box and the artwork's smallest
enclosing circle both let those outliers drag the wallet off centre inside the
disc. `trace-logo.py` also asserts the ink clears the disc edge, so new artwork
fails loudly rather than getting silently clipped, and `make-icons.py` anchors
the launcher icons the same way so they cannot drift from the in-app logo.

Coin icons are constructed rather than exported, since the network policy also
blocks the Figma icon assets: Bitcoin and Tether are typographic (₿, ₮),
Ethereum, Binance and Solana are polygons, Cardano is its generated dot
lattice, USDC its dollar glyph. A symbol with no mark falls back to a branded
monogram — that fallback is a placeholder, not a design, so add the geometry in
`CoinIcon.tsx` when a new asset starts being listed.

The design's screens for buy, sell, staking, NFTs, referrals, and support are
not built — this is the onboarding and core-wallet slice.
