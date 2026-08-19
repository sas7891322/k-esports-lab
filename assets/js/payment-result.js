(function () {
  const PURCHASE_STORAGE_KEY = "kel_purchases_v1";
  const params = new URLSearchParams(location.search);
  const order = params.get("order") || "";
  const token = params.get("token") || "";
  let pollTimer = null;
  let pollCount = 0;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));

  function initMenu() {
    const btn = $("menuBtn"), menu = $("mobileMenu");
    if (btn && menu) btn.addEventListener("click", () => menu.classList.toggle("open"));
  }

  function storeUnlock(matchId) {
    if (!matchId || !order || !token) return;
    let purchases = {};
    try { purchases = JSON.parse(localStorage.getItem(PURCHASE_STORAGE_KEY) || "{}") || {}; } catch {}
    purchases[matchId] = { order, token };
    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(purchases));
  }

  function renderPaymentInfo(info, amount, paymentType) {
    const box = $("paymentInfoBox");
    if (!box) return;
    const rows = [];
    if (amount) rows.push(["應付金額", `NT$${amount}`]);
    if (paymentType) rows.push(["付款方式", paymentType]);
    if (info.BankCode) rows.push(["銀行代碼", info.BankCode]);
    if (info.vAccount) rows.push(["ATM 虛擬帳號", info.vAccount]);
    if (info.PaymentNo) rows.push(["超商繳費代碼", info.PaymentNo]);
    if (info.ExpireDate) rows.push(["繳費期限", info.ExpireDate]);
    if (!rows.length) { box.hidden = true; return; }
    box.innerHTML = rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("");
    box.hidden = false;
  }

  function setState(kind, title, text) {
    const icons = { loading: "…", pending: "⌛", paid: "✓", error: "!" };
    $("paymentStatusIcon").textContent = icons[kind] || "…";
    $("paymentStatusIcon").dataset.state = kind;
    $("paymentStatusTitle").textContent = title;
    $("paymentStatusText").textContent = text;
  }

  async function checkStatus() {
    if (!order || !token) {
      setState("error", "找不到訂單憑證", "這個付款狀態網址缺少必要資料，請從原 K Premium 商品頁重新建立訂單。");
      return;
    }
    try {
      const res = await fetch(`/api/order-status?order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
      renderPaymentInfo(data.paymentInfo || {}, data.amount, data.paymentType);
      if (data.status === "paid") {
        if (pollTimer) clearTimeout(pollTimer);
        storeUnlock(data.matchId);
        setState("paid", "付款成功，K Premium 已解鎖", "綠界付款成功通知已由系統確認。你可以立即返回該場賽事閱讀完整分析內容。");
        const actions = $("paymentResultActions");
        actions.innerHTML = `<a class="btn btn-gold" href="match.html?id=${encodeURIComponent(data.matchId)}&order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}">閱讀已解鎖內容</a><a class="btn btn-secondary" href="index.html">返回首頁</a>`;
        return;
      }
      setState("pending", "訂單已建立，等待付款完成", "尚未收到綠界的付款成功通知。完成 ATM／超商繳費後，本頁會持續重新確認。 ");
      if (pollCount++ < 150) pollTimer = setTimeout(checkStatus, 4000);
    } catch (error) {
      console.error(error);
      setState("error", "暫時無法確認訂單", "請確認網路連線後再按一次「重新確認」；若仍有問題，請聯絡客服並提供訂單編號。 ");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    $("refreshPaymentStatus")?.addEventListener("click", () => { pollCount = 0; checkStatus(); });
    checkStatus();
  });
})();
