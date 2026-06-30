// Nolasa veGWEI lock datus konkretam makam (read-only, publiskais RPC)
const { ethers } = require("ethers");

const VE = "0x13ab49189ebc2287e941a82d9af154130f96eb21";   // veGWEI VotingEscrow
const GWEI = "0x2798b1cc5a993085e8a9d46e80499f1b63f42204"; // GWEI tokens
const WALLET = process.argv[2];

const VE_ABI = [
  "function locked(address) view returns (int128 amount, uint256 end)",
  "function locked__end(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)", // veGWEI vara (decay)
];
const ERC20 = ["function balanceOf(address) view returns (uint256)"];

(async () => {
  const rpcs = [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
    "https://1rpc.io/eth",
  ];
  let provider;
  for (const url of rpcs) {
    try {
      const p = new ethers.providers.JsonRpcProvider(url, 1);
      await p.getBlockNumber();
      provider = p; break;
    } catch (_) {}
  }
  if (!provider) throw new Error("Neviens RPC nestrada");

  const ve = new ethers.Contract(VE, VE_ABI, provider);
  const gwei = new ethers.Contract(GWEI, ERC20, provider);

  const locked = await ve.locked(WALLET);
  const end = locked.end;
  const amount = locked.amount; // int128, 18 decimals
  const now = Math.floor(Date.now() / 1000);
  const freeGwei = await gwei.balanceOf(WALLET); // jau brivie GWEI maka

  const endDate = new Date(end.toNumber() * 1000).toISOString();
  console.log("Maks            :", WALLET);
  console.log("Lock'ots GWEI   :", ethers.utils.formatUnits(amount, 18));
  console.log("Lock beidzas    :", end.toString(), "(", endDate, "UTC )");
  console.log("Sodien          :", now);
  console.log("Lock BEIDZIES?  :", end.toNumber() <= now ? "JA -> var withdraw()" : "NE -> vel nevar");
  console.log("Brivie GWEI maka:", ethers.utils.formatUnits(freeGwei, 18));

  // ieteicama AMOUNT vertiba (viss, kas bus maka pec withdraw)
  const total = amount.add(freeGwei);
  console.log("\nKopa pec withdraw:", ethers.utils.formatUnits(total, 18), "GWEI");
  console.log("Iesakaamais AMOUNT (.env):", ethers.utils.formatUnits(total, 18));
})().catch((e) => console.error("KLUDA:", e.message));
