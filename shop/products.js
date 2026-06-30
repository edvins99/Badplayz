/* =============================================================
   PRODUKTU SARAKSTS — REDIĢĒ ŠEIT
   =============================================================
   Lai nomainītu produktu:
   - image: ceļš uz attēlu (ieliec savu attēlu mapē assets/products/)
   - name:  produkta nosaukums
   - price: cena (skaitlis)
   - tag:   maza etiķete (piem. "NEW", "HOT", "LIMITED") vai ""
   - desc:  īss apraksts
   - buyUrl: saite uz pirkšanu (dropshipping checkout / Printful / utt.)
              ja atstāj "", poga pievienos grozam

   Lai pievienotu jaunu produktu — nokopē vienu { ... } bloku.
   ============================================================= */

window.PRODUCTS = [
  {
    id: "btc-tee",
    image: "assets/products/btc.svg",
    name: "Bitcoin Genesis Tee",
    price: 29.99,
    tag: "HOT",
    desc: "Premium cotton. The original. ₿ embroidered front.",
    buyUrl: ""
  },
  {
    id: "eth-tee",
    image: "assets/products/eth.svg",
    name: "Ethereum Merge Tee",
    price: 29.99,
    tag: "",
    desc: "Smart contract style. Ξ minimal print.",
    buyUrl: ""
  },
  {
    id: "sol-tee",
    image: "assets/products/sol.svg",
    name: "Solana Speed Tee",
    price: 27.99,
    tag: "NEW",
    desc: "Fast chain energy. Neon green accent.",
    buyUrl: ""
  },
  {
    id: "doge-tee",
    image: "assets/products/doge.svg",
    name: "Doge Much Wow Tee",
    price: 24.99,
    tag: "",
    desc: "Meme royalty. Ð for the people.",
    buyUrl: ""
  },
  {
    id: "hodl-tee",
    image: "assets/products/hodl.svg",
    name: "HODL Forever Tee",
    price: 26.99,
    tag: "LIMITED",
    desc: "Diamond mindset. Never sell. ◆",
    buyUrl: ""
  },
  {
    id: "diamond-tee",
    image: "assets/products/diamond.svg",
    name: "Diamond Hands Tee",
    price: 31.99,
    tag: "",
    desc: "Hold through the dips. ♦ purple glow.",
    buyUrl: ""
  },
  {
    id: "yellow-tee",
    image: "assets/products/yellow.svg",
    name: "Yellow Network Tee",
    price: 28.99,
    tag: "NEW",
    desc: "Repping the clearing layer. Bright Y.",
    buyUrl: ""
  },
  {
    id: "moon-tee",
    image: "assets/products/moon.svg",
    name: "To The Moon Tee",
    price: 25.99,
    tag: "HOT",
    desc: "Bullish forever. Pink neon moon.",
    buyUrl: ""
  }
];

/* Veikala iestatījumi */
window.SHOP_CONFIG = {
  brand: "BADPLAYZ // CRYPTO TEES",
  tagline: "wear the chain",
  currency: "€",
  // Kontakts pasūtījumiem (ja buyUrl ir tukšs, grozs novirzīs šeit)
  checkoutContact: "https://t.me/badplayz",
  freeShipOver: 50
};
