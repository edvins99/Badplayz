/**
 * wallet-rescue / recover.js
 * -------------------------------------------------------------
 * Atomara lidzeklu glabsana no uzlauzta ("drained") maka, ko vero
 * sweeper-bots, izmantojot Flashbots bundle uz Ethereum mainnet.
 *
 * Ideja: VIENA atomara pakete (bundle), kas vai nu izpildas VISA, vai
 * NEVIENA. Sweeper-bots to neredz (privats kanals), tapec nevar nozagt
 * gazi, ko sponsora maks iesuta uzlautajam makam.
 *
 * Pakete (secigi, viena bloka):
 *   tx0: SPONSORS  -> UZLAUSTAIS   (iesuta tiri tik ETH, cik vajag gazei)
 *   tx1: UZLAUSTAIS -> STAKING     (withdraw / unstake / claim)        [neobligati]
 *   tx2: UZLAUSTAIS -> DROSAIS     (parsuta izglabto tokenu / ETH)
 *
 * DROSIBA:
 *   - Privatas atslegas tikai lokali .env faila. Nekad nesuti tas nevienam.
 *   - Vispirms palaid simulaciju:  npm run simulate
 *   - Tikai tad reali:             npm run rescue
 * -------------------------------------------------------------
 */

require("dotenv").config();
const { ethers } = require("ethers");
const {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} = require("@flashbots/ethers-provider-bundle");

// ---------- Palighfunkcijas konfiguracijai ----------
function req(name) {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Truksta obligata vertiba .env faila: ${name}`);
  }
  return v.trim();
}
function opt(name, def = "") {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : def;
}

const DRY_RUN = process.env.DRY_RUN === "1";

// ---------- Konfiguracija (.env) ----------
const RPC_URL = req("RPC_URL");                 // mainnet RPC (Alchemy/Infura/u.c.)
const CHAIN_ID = parseInt(opt("CHAIN_ID", "1"));

const COMPROMISED_PK = req("COMPROMISED_PK");   // uzlauta maka privata atslega
const SPONSOR_PK = req("SPONSOR_PK");           // tira maka atslega, kas maksa gazi
const SAFE_ADDRESS = req("SAFE_ADDRESS");       // kurp suti izglabtos lidzeklus

// Solis 1 (neobligati): withdraw/unstake izsaukums uz staking kontraktu
const STAKING_CONTRACT = opt("STAKING_CONTRACT"); // ja tukss -> withdraw solis izlaists
const WITHDRAW_DATA = opt("WITHDRAW_DATA", "0x"); // gatavs calldata (hex)
const WITHDRAW_VALUE = opt("WITHDRAW_VALUE", "0"); // ETH, ko sutit lidzi (parasti 0)

// Solis 2: ko parsutit uz droso maku
//   ASSET_TYPE = "ERC20"  -> parsuta TOKEN_ADDRESS tokenu, daudzums AMOUNT
//   ASSET_TYPE = "ETH"    -> parsuta ETH, daudzums AMOUNT
const ASSET_TYPE = opt("ASSET_TYPE", "ERC20").toUpperCase();
const TOKEN_ADDRESS = opt("TOKEN_ADDRESS");
const TOKEN_DECIMALS = parseInt(opt("TOKEN_DECIMALS", "18"));
const AMOUNT = opt("AMOUNT"); // cilveklasama summa, piem. "150.5". Tuks -> mēģina visu atlikumu

// Gazes parametri
const PRIORITY_GWEI = opt("PRIORITY_GWEI", "3");           // validatora "dzeramnauda"
const GAS_LIMIT_WITHDRAW = parseInt(opt("GAS_LIMIT_WITHDRAW", "320000"));
const GAS_LIMIT_TRANSFER = parseInt(opt("GAS_LIMIT_TRANSFER", "90000"));
const BLOCKS_TO_TRY = parseInt(opt("BLOCKS_TO_TRY", "25")); // cik blokus mēģināt

const FLASHBOTS_RELAY = opt("FLASHBOTS_RELAY", "https://relay.flashbots.net");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL, CHAIN_ID);

  // Atseviska atslega Flashbots reputacijai (NAV jatur lidzeklu)
  const authSigner = ethers.Wallet.createRandom();
  const flashbots = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    FLASHBOTS_RELAY,
    CHAIN_ID === 1 ? "mainnet" : undefined
  );

  const compromised = new ethers.Wallet(COMPROMISED_PK, provider);
  const sponsor = new ethers.Wallet(SPONSOR_PK, provider);

  console.log("=== wallet-rescue ===");
  console.log("Uzlautais maks :", compromised.address);
  console.log("Sponsora maks  :", sponsor.address);
  console.log("Drosais maks   :", SAFE_ADDRESS);
  console.log("Rezims         :", DRY_RUN ? "SIMULACIJA (nekas netiek sutits)" : "REALS");
  console.log("");

  // --- Gazes cenas ---
  const block = await provider.getBlock("latest");
  const baseFee = block.baseFeePerGas;
  const priority = ethers.utils.parseUnits(PRIORITY_GWEI, "gwei");
  // maxFee ar rezervi (baseFee var pieaugt nakamaja bloka)
  const maxFeePerGas = baseFee.mul(2).add(priority);
  console.log("baseFee (gwei) :", ethers.utils.formatUnits(baseFee, "gwei"));
  console.log("maxFee  (gwei) :", ethers.utils.formatUnits(maxFeePerGas, "gwei"));

  // --- Cik gazes ETH vajag uzlautajam makam ---
  const withdrawStep = STAKING_CONTRACT && WITHDRAW_DATA && WITHDRAW_DATA !== "0x";
  const totalGasLimit =
    (withdrawStep ? GAS_LIMIT_WITHDRAW : 0) + GAS_LIMIT_TRANSFER;
  // Iesutam nedaudz vairak (1.0x maxFee * gas), lai noteikti pietiek.
  const gasBudget = maxFeePerGas.mul(totalGasLimit);
  console.log("Gazes budzets  :", ethers.utils.formatEther(gasBudget), "ETH");

  // Parbaude: vai sponsoram pietiek lidzeklu
  const sponsorBal = await provider.getBalance(sponsor.address);
  const sponsorNeed = gasBudget.add(maxFeePerGas.mul(21000)); // + tx0 paspaja gaze
  if (sponsorBal.lt(sponsorNeed)) {
    throw new Error(
      `Sponsora makam par maz ETH. Ir ${ethers.utils.formatEther(
        sponsorBal
      )} ETH, vajag vismaz ~${ethers.utils.formatEther(sponsorNeed)} ETH.`
    );
  }

  // --- Solis 2 summa ---
  let transferTx;
  if (ASSET_TYPE === "ERC20") {
    if (!TOKEN_ADDRESS) throw new Error("ASSET_TYPE=ERC20, bet truksta TOKEN_ADDRESS");
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
    let amount;
    if (AMOUNT) {
      amount = ethers.utils.parseUnits(AMOUNT, TOKEN_DECIMALS);
    } else {
      // ja withdraw notiek bunda, pasreizejais atlikums vel neietver izglabto.
      // Tapec, ja ir withdraw solis, OBLIGATI jagive AMOUNT.
      if (withdrawStep) {
        throw new Error(
          "Ir withdraw solis -> .env janorada AMOUNT (cik tokenu parsutit pec izņemšanas)."
        );
      }
      amount = await token.balanceOf(compromised.address);
    }
    console.log("Parsutam       :", ethers.utils.formatUnits(amount, TOKEN_DECIMALS), "tokenu");
    const data = token.interface.encodeFunctionData("transfer", [SAFE_ADDRESS, amount]);
    transferTx = { to: TOKEN_ADDRESS, data, value: 0, gasLimit: GAS_LIMIT_TRANSFER };
  } else if (ASSET_TYPE === "ETH") {
    if (!AMOUNT) throw new Error("ASSET_TYPE=ETH -> norada AMOUNT (cik ETH parsutit)");
    const amount = ethers.utils.parseEther(AMOUNT);
    console.log("Parsutam       :", AMOUNT, "ETH");
    transferTx = { to: SAFE_ADDRESS, data: "0x", value: amount, gasLimit: 21000 };
  } else {
    throw new Error(`Nezinams ASSET_TYPE: ${ASSET_TYPE} (atlauts: ERC20 vai ETH)`);
  }

  // --- Nonces ---
  const compromisedNonce = await provider.getTransactionCount(compromised.address, "latest");
  const sponsorNonce = await provider.getTransactionCount(sponsor.address, "latest");

  const common = { type: 2, chainId: CHAIN_ID, maxFeePerGas, maxPriorityFeePerGas: priority };

  // tx0: sponsors -> uzlautais (gaze)
  const fundTx = {
    signer: sponsor,
    transaction: {
      ...common,
      to: compromised.address,
      value: gasBudget,
      gasLimit: 21000,
      nonce: sponsorNonce,
    },
  };

  const bundleTxs = [fundTx];
  let nextNonce = compromisedNonce;

  // tx1: uzlautais -> staking (withdraw) [neobligati]
  if (withdrawStep) {
    bundleTxs.push({
      signer: compromised,
      transaction: {
        ...common,
        to: STAKING_CONTRACT,
        data: WITHDRAW_DATA,
        value: WITHDRAW_VALUE === "0" ? 0 : ethers.utils.parseEther(WITHDRAW_VALUE),
        gasLimit: GAS_LIMIT_WITHDRAW,
        nonce: nextNonce++,
      },
    });
  }

  // tx2: uzlautais -> drosais (parsutisana)
  bundleTxs.push({
    signer: compromised,
    transaction: { ...common, ...transferTx, nonce: nextNonce++ },
  });

  const signedBundle = await flashbots.signBundle(bundleTxs);

  // --- Simulacija nakamaja bloka ---
  const targetBlock = block.number + 1;
  console.log("\nSimulacija bloka", targetBlock, "...");
  const sim = await flashbots.simulate(signedBundle, targetBlock);
  if ("error" in sim) {
    console.error("Simulacijas KLUDA:", sim.error.message);
    process.exit(1);
  }
  if (sim.firstRevert) {
    console.error("Kads darijums REVERT:", JSON.stringify(sim.firstRevert, null, 2));
    console.error("-> Parbaudi WITHDRAW_DATA / kontraktu / daudzumu.");
    process.exit(1);
  }
  console.log("Simulacija OK. Kopejas gazes izmaksas:",
    ethers.utils.formatEther(sim.coinbaseDiff), "ETH (aptuveni)");

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 -> apstajos. Nekas netika sutits. Ja viss OK, palaid: npm run rescue");
    return;
  }

  // --- Reala sutisana vairakos blokos, lidz iekluts ---
  console.log("\nSutu bundle uz Flashbots (megina lidz", BLOCKS_TO_TRY, "blokus)...");
  const current = await provider.getBlockNumber();
  for (let i = 1; i <= BLOCKS_TO_TRY; i++) {
    const target = current + i;
    const submission = await flashbots.sendRawBundle(signedBundle, target);
    if ("error" in submission) {
      console.error("Iesniegsanas kluda:", submission.error.message);
      continue;
    }
    const resolution = await submission.wait();
    if (resolution === FlashbotsBundleResolution.BundleIncluded) {
      console.log(`\n✅ IEKLAUTS bloka ${target}! Lidzekli izglabti uz ${SAFE_ADDRESS}.`);
      const receipts = await submission.receipts();
      receipts.forEach((r, idx) => console.log(`  tx${idx}: ${r.transactionHash}`));
      return;
    } else if (resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log(`  bloks ${target}: neiekluva, meginam talak...`);
    } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log("  Nonce parak augsts -> iespejams, jau izpildits. Apstajos.");
      return;
    }
  }
  console.log("\nNeiekluva nevena bloka. Var palaist velreiz (palielinat PRIORITY_GWEI).");
}

main().catch((e) => {
  console.error("\nKLUDA:", e.message);
  process.exit(1);
});
