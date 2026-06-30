// Atrs token parbaudes skripts (publiskais RPC, bez atslegam)
const { ethers } = require("ethers");
const ERC20 = [
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];
(async () => {
  const addr = process.argv[2] || "0x2798b1cc5a993085e8a9d46e80499f1b63f42204";
  const rpcs = ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth", "https://cloudflare-eth.com"];
  for (const url of rpcs) {
    try {
      const p = new ethers.providers.JsonRpcProvider(url, 1);
      const t = new ethers.Contract(addr, ERC20, p);
      const code = await p.getCode(addr);
      if (code === "0x") { console.log(url, "-> nav kontrakts"); continue; }
      const [name, symbol, dec, sup] = await Promise.all([
        t.name(), t.symbol(), t.decimals(), t.totalSupply(),
      ]);
      console.log("RPC      :", url);
      console.log("Adrese   :", addr);
      console.log("Name     :", name);
      console.log("Symbol   :", symbol);
      console.log("Decimals :", dec);
      console.log("Supply   :", ethers.utils.formatUnits(sup, dec));
      return;
    } catch (e) {
      console.log(url, "-> kluda:", e.message.slice(0, 60));
    }
  }
})();
