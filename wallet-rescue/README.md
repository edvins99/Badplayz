# wallet-rescue

Atomāra (Flashbots bundle) līdzekļu glābšana no uzlauzta ("drained") maka,
ko vēro sweeper-bots. **Tikai Ethereum mainnet.**

## Kāpēc tas strādā

Sweeper-bots vēro publisko mempool. Tiklīdz tu iesūti gāzi uzlauztajā makā,
bots to dažās sekundēs nozog. Šis skripts to apiet: tas izveido **vienu atomāru
paketi** (bundle) un nosūta to caur Flashbots **privāto kanālu**, tāpēc bots
gāzi nemaz neredz. Pakete vai nu izpildās VISA, vai NEVIENA:

```
tx0: SPONSORS   -> UZLAUSTAIS   (iesūta tikai gāzes ETH)
tx1: UZLAUSTAIS -> STAKING      (withdraw / unstake)        [neobligāti]
tx2: UZLAUSTAIS -> DROŠAIS      (pārsūta izglābto)
```

## ⚠️ Drošība pirmām kārtām

- Privātās atslēgas dzīvo **tikai lokāli** `.env` failā. **Nekad ne ar vienu nedalies.**
- Šo maku pēc tam **vairs nelieto** — atslēga ir zagļa rokās.
- Uzmanies no "recovery" krāpniekiem, kas DM piedāvā atgūt naudu par maksu.

## Kas tev būs vajadzīgs

1. **Mainnet RPC URL** — bezmaksas konts Alchemy vai Infura.
2. **Uzlauztā maka privātā atslēga** (tā, kurā ir staking).
3. **Sponsora maks** — jauns/tīrs maks ar nedaudz ETH gāzei (~$10–30 vērts).
4. **Drošais maks** — kurp aizies izglābtie līdzekļi.
5. **Staking kontrakta adrese** + kā sauc izņemšanas funkciju (`withdraw`/`unstake`/`exit`/`claim`).

## Soļi

```bash
# 1. atkarības
npm install

# 2. konfigurācija
cp .env.example .env
#    -> aizpildi .env (skat. komentārus failā)

# 3. SIMULĀCIJA (nekas netiek sūtīts, tikai pārbaude)
npm run simulate

# 4. ja simulācija OK -> REĀLĀ glābšana
npm run rescue
```

## Kā dabūt `WITHDRAW_DATA` (calldata)

Šis ir gatavs `0x...` hex, kas apraksta izņemšanas izsaukumu. Varianti:

- **Vienkāršākais:** atsūti man (čatā) staking kontrakta adresi un izņemšanas
  funkcijas nosaukumu + argumentus — es to uzkodēšu tev gatavu.
- **Pašam caur Etherscan:** kontrakta lapā → *Contract* → *Write Contract* →
  atrodi `withdraw`-tipa funkciju → ievadi argumentus. (Var paņemt calldata no
  darījuma sagataves.)

Ja tokeni jau ir **brīvi makā** (nav stakingā), atstāj `STAKING_CONTRACT` tukšu —
skripts izlaidīs withdraw soli un vienkārši pārsūtīs tokenu.

## ⭐ Konkrēti: $GWEI (ETHGas) staking

Pārbaudīts on-chain:
- **GWEI tokens (ERC-20, mainnet):** `0x2798b1cc5a993085e8a9d46e80499f1b63f42204`
  (symbol = `GWEI`, decimals = `18`)
- **Tev stakingā:** 630.34 GWEI, lock beidzies (Apr 02, 2026), unstake pieejams.
- **Rewards 0.1641 GWEI** ≈ daži centi — **NEMAKSĀ atsevišķi gāzi par claim**,
  nav tā vērts. Koncentrējamies uz 630 GWEI.

### Kā dabūt `STAKING_CONTRACT` + `WITHDRAW_DATA` (visdrošāk, neko neparakstot)

Šādi iegūsi 100% pareizu kontrakta adresi un calldata tieši no dApp:

1. Atver ETHGas staking dApp pārlūkā ar MetaMask un pieslēdz **uzlaupīto** maku.
   (Pieslēgšana / skatīšana neko nesūta uz ķēdi — sweeper-bots uz to nereaģē.)
2. Spied **"Unstake"**. MetaMask atvērs apstiprinājuma logu.
3. Tajā logā atrodi:
   - **"To" / saņēmēja adrese** = tā ir `STAKING_CONTRACT`.
   - **"Hex" / "Data"** sadaļu (View data / Hex) = tas garais `0x...` ir `WITHDRAW_DATA`.
4. **Nokopē abus un nospied "Reject" / "Cancel".** NEPARAKSTI darījumu dApp!
   (Mēs to izpildīsim caur Flashbots paketi, nevis publiski.)
5. Ieliec abus `.env` failā un palaid `npm run simulate`.

> Ja "Unstake" pieprasa 2 darījumus (piem. atsevišķs "withdraw"), nokopē abu
> calldata un pasaki man — pielāgošu skriptu, lai izpilda abus vienā paketē.

## Biežākās kļūdas

- **"Sponsora makam par maz ETH"** — pielej sponsoram vairāk ETH.
- **"Kāds darījums REVERT"** — `WITHDRAW_DATA` vai daudzums nav pareizs;
  pārbaudi kontraktu/argumentus.
- **Neiekļaujas blokā** — palielini `PRIORITY_GWEI` (piem. 5–10) un mēģini vēlreiz.
