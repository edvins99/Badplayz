# BADPLAYZ // Crypto Tees — dropshipping veikals

Moderns, animēts crypto T-kreklu veikals. Statisks (HTML/CSS/JS) — strādā uz GitHub Pages un Vercel.

## 🖼️ Kā nomainīt attēlus ar saviem produktiem

**Variants A — aizvieto failu (visvienkāršāk):**
1. Ej uz mapi `shop/assets/products/`
2. Aizvieto kādu failu (piem. `btc.svg`) ar savu attēlu
3. Saglabā ar **to pašu nosaukumu** (vai `.jpg`/`.png` — tad atjaunini ceļu `products.js`)

**Variants B — rediģē `products.js` (pilna kontrole):**
Atver `shop/products.js`. Katrs produkts izskatās šādi:

```js
{
  id: "btc-tee",                        // unikāls ID
  image: "assets/products/btc.svg",     // ceļš uz tavu attēlu
  name: "Bitcoin Genesis Tee",          // nosaukums
  price: 29.99,                         // cena
  tag: "HOT",                           // etiķete: "NEW","HOT","LIMITED" vai ""
  desc: "Premium cotton...",            // apraksts
  buyUrl: ""                            // pirkšanas saite (skat. zemāk)
}
```

- **Nomainīt attēlu:** maini `image`
- **Pievienot produktu:** nokopē vienu `{ ... }` bloku un maini saturu
- **Noņemt produktu:** izdzēs tā `{ ... }` bloku

## 🛒 Pirkšana / dropshipping

Katram produktam ir `buyUrl`:
- **Tukšs `""`** → poga "checkout" sūta pasūtījumu uz tavu kontaktu (skat. `SHOP_CONFIG.checkoutContact`)
- **Ar saiti** → poga ved tieši uz to (piem. Printful, Printify, Gelato, Shopify checkout)

Iestatījumi faila apakšā (`SHOP_CONFIG`):
```js
window.SHOP_CONFIG = {
  brand: "BADPLAYZ // CRYPTO TEES",
  tagline: "wear the chain",
  currency: "€",
  checkoutContact: "https://t.me/badplayz", // kur sūtīt pasūtījumus
  freeShipOver: 50
};
```

## 🚀 Publicēšana

### GitHub Pages (jau iestatīts šim repo)
Pēc merge uz `main` veikals būs pieejams:
**https://edvins99.github.io/Badplayz/shop/**

### Vercel (ja gribi atsevišķi)
1. Ej uz vercel.com → "Add New Project"
2. Importē savu GitHub repo `Badplayz`
3. **Root Directory:** norādi `shop`
4. Framework: "Other" (statisks)
5. Deploy → dabūsi saiti `tavs-veikals.vercel.app`

## 💡 Dropshipping padomi
- **Printful / Printify / Gelato** — uzliec savus dizainus, viņi drukā un sūta
- Saņem produkta attēlu (mockup) no tiem → ieliec `assets/products/`
- Saņem produkta saiti → ieliec `buyUrl`
- Tā tev nav jātur noliktava — viss notiek automātiski


## 👕 Modeļu attēli (lookbook)

Sadaļa `// lookbook` rāda cilvēkus, kas valkā tavus kreklus.
- Faili: `shop/assets/models/model_01.jpg`, `model_02.jpg`, `model_03.jpg`
- Aizvieto tos ar saviem modeļu/dzīvesstila foto (saglabā tos pašus nosaukumus)
- Vai rediģē `index.html` sadaļā `<section id="lookbook">` — maini `src` un nosaukumus

Padoms: Printful/Printify ģenerē arī modeļu mockup attēlus — tos var ielikt gan produktu kartēs, gan lookbook sadaļā.
