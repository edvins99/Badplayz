/* ===== BADPLAYZ CRYPTO TEES — store logic ===== */
(function () {
  "use strict";
  const cfg = window.SHOP_CONFIG || {};
  const products = window.PRODUCTS || [];
  const CUR = cfg.currency || "€";

  // ---- state ----
  let cart = JSON.parse(localStorage.getItem("bp_cart") || "{}");

  // ---- helpers ----
  const $ = (s) => document.querySelector(s);
  const money = (n) => CUR + n.toFixed(2);
  const save = () => localStorage.setItem("bp_cart", JSON.stringify(cart));

  // ---- brand / config text ----
  $("#brandText").textContent = cfg.brand || "CRYPTO TEES";
  $("#year").textContent = new Date().getFullYear();
  if (cfg.freeShipOver) $("#shipNote").textContent = `◆ free shipping over ${CUR}${cfg.freeShipOver}`;

  // ---- marquee ----
  const words = ["BITCOIN", "◆", "ETHEREUM", "◆", "SOLANA", "◆", "HODL", "◆", "DIAMOND HANDS", "◆", "TO THE MOON", "◆", "WEAR THE CHAIN", "◆"];
  $("#marqueeTrack").innerHTML = (words.concat(words))
    .map((w) => (w === "◆" ? `<span>◆</span>` : w)).join("&nbsp;&nbsp;&nbsp;&nbsp;");

  // ---- render products ----
  const grid = $("#productGrid");
  grid.innerHTML = products.map((p) => `
    <article class="product" data-id="${p.id}">
      <div class="product__imgwrap">
        ${p.tag ? `<span class="product__tag">${p.tag}</span>` : ""}
        <img class="product__img" src="${p.image}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="product__body">
        <h3 class="product__name">${p.name}</h3>
        <p class="product__desc">${p.desc || ""}</p>
        <div class="product__row">
          <span class="product__price">${money(p.price)}</span>
          <button class="product__add" data-add="${p.id}">add +</button>
        </div>
      </div>
    </article>`).join("");

  // ---- scroll reveal for product + lookbook cards ----
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add("in"), (i % 4) * 80);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll(".product, .look").forEach((el) => io.observe(el));

  // ---- cart logic ----
  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    save(); updateCart(); toast("added to bag ✓"); bumpCount();
  }
  function setQty(id, q) {
    if (q <= 0) delete cart[id]; else cart[id] = q;
    save(); updateCart();
  }
  function cartCount() { return Object.values(cart).reduce((a, b) => a + b, 0); }
  function cartTotal() {
    return Object.entries(cart).reduce((sum, [id, q]) => {
      const p = products.find((x) => x.id === id); return sum + (p ? p.price * q : 0);
    }, 0);
  }

  function bumpCount() {
    const el = $("#cartCount");
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }

  function updateCart() {
    const count = cartCount();
    const cEl = $("#cartCount");
    cEl.textContent = count;
    cEl.classList.toggle("show", count > 0);
    $("#cartTotal").textContent = money(cartTotal());

    const wrap = $("#drawerItems");
    const entries = Object.entries(cart);
    if (!entries.length) {
      wrap.innerHTML = `<p class="drawer__empty">your bag is empty.<br/>add some tees ◆</p>`;
      return;
    }
    wrap.innerHTML = entries.map(([id, q]) => {
      const p = products.find((x) => x.id === id); if (!p) return "";
      return `<div class="citem">
        <img src="${p.image}" alt="${p.name}" />
        <div class="citem__info">
          <div class="citem__name">${p.name}</div>
          <div class="citem__price">${money(p.price)}</div>
        </div>
        <div class="citem__qty">
          <button data-dec="${id}">−</button><span>${q}</span><button data-inc="${id}">+</button>
        </div>
      </div>`;
    }).join("");
  }

  // ---- drawer ----
  const drawer = $("#drawer"), overlay = $("#drawerOverlay");
  function openDrawer() { drawer.classList.add("open"); overlay.classList.add("open"); }
  function closeDrawer() { drawer.classList.remove("open"); overlay.classList.remove("open"); }

  // ---- toast ----
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---- checkout ----
  function checkout() {
    const entries = Object.entries(cart);
    if (!entries.length) { toast("bag is empty"); return; }
    // If any product has a buyUrl, prefer the first one; otherwise build an order message
    const withUrl = entries.map(([id]) => products.find((p) => p.id === id)).find((p) => p && p.buyUrl);
    if (withUrl) { window.open(withUrl.buyUrl, "_blank"); return; }
    // Build an order summary and send to contact
    const lines = entries.map(([id, q]) => {
      const p = products.find((x) => x.id === id); return `${q}x ${p.name} (${money(p.price)})`;
    });
    const msg = `Order:%0A${lines.join("%0A")}%0A%0ATotal: ${money(cartTotal())}`;
    const contact = cfg.checkoutContact || "#";
    const url = contact.includes("t.me") ? `${contact}?text=${msg}` : contact;
    window.open(url, "_blank");
    toast("opening checkout…");
  }

  // ---- events ----
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const card = e.target.closest(".product");
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (add) { e.stopPropagation(); addToCart(add.dataset.add); return; }
    if (card) { addToCart(card.dataset.id); return; }
    if (inc) { setQty(inc.dataset.inc, (cart[inc.dataset.inc] || 0) + 1); return; }
    if (dec) { setQty(dec.dataset.dec, (cart[dec.dataset.dec] || 0) - 1); return; }
  });
  $("#cartBtn").addEventListener("click", openDrawer);
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#drawerOverlay").addEventListener("click", closeDrawer);
  $("#checkoutBtn").addEventListener("click", checkout);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  // ---- init ----
  updateCart();
})();
