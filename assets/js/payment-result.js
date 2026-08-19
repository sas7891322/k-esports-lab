(function () {
  const PURCHASE_STORAGE_KEY = "kel_purchases_v1";
  const params = new URLSearchParams(location.search);
  const order = params.get("order") || "";
  const token = params.get("token") || "";
  let pollTimer = null;
  let pollCount = 0;
  let scrubbed = false;

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

  function scrubAccessFromAddressBar() {
    if (scrubbed) return;
    scrubbed = true;
    try { history.replaceState(null, "", "payment-result.html"); } catch {}
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
    const icons = { loading: "…", pending: "⌛", verified: "✓", paid: "✓", error: "!" };
    $("paymentStatusIcon").textContent = icons[kind] || "…";
    $("paymentStatusIcon").dataset.state = kind === "verified" ? "paid" : kind;
    $("paymentStatusTitle").textContent = title;
    $("paymentStatusText").textContent = text;
  }

  function renderDefaultActions() {
    const actions = $("paymentResultActions");
    actions.innerHTML = `<button id="refreshPaymentStatus" class="btn btn-secondary" type="button">重新確認</button><a class="btn btn-secondary" href="premium.html">返回 K Premium</a>`;
    $("refreshPaymentStatus")?.addEventListener("click", () => { pollCount = 0; checkStatus(); });
  }

  async function stageUnlock(matchId) {
    const actions = $("paymentResultActions");
    const button = actions.querySelector("[data-stage-unlock]");
    if (button) { button.disabled = true; button.textContent = "建立 STAGE 測試解鎖中…"; }
    try {
      const res = await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ action: "stage_unlock", order, token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
      await checkStatus();
    } catch (error) {
      console.error(error);
      setState("error", "STAGE 測試解鎖失敗", "請先確認綠界 STAGE 後台已發送模擬付款通知，並且本站 ReturnURL 已成功收到通知。");
      renderDefaultActions();
    }
  }

  function renderStageVerifiedActions(matchId) {
    const actions = $("paymentResultActions");
    actions.innerHTML = `<button class="btn btn-gold" type="button" data-stage-unlock>完成 STAGE 測試解鎖</button><button class="btn btn-secondary" type="button" id="refreshPaymentStatus">重新確認</button><a class="btn btn-secondary" href="premium.html">返回 K Premium</a>`;
    actions.querySelector("[data-stage-unlock]")?.addEventListener("click", () => stageUnlock(matchId));
    $("refreshPaymentStatus")?.addEventListener("click", () => { pollCount = 0; checkStatus(); });
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

      if (data.status === "paid" || data.status === "stage_paid") {
        if (pollTimer) clearTimeout(pollTimer);
        storeUnlock(data.matchId);
        const stage = data.status === "stage_paid";
        setState(
          "paid",
          stage ? "STAGE 測試解鎖完成" : "付款成功，K Premium 已解鎖",
          stage
            ? "這是 STAGE 測試解鎖，不代表真實付款；正式環境只會在收到真實付款成功通知後解鎖。"
            : "綠界真實付款成功通知已由系統確認。你可以立即返回該場賽事閱讀完整分析內容。"
        );
        const actions = $("paymentResultActions");
        actions.innerHTML = `<a class="btn btn-gold" href="match.html?id=${encodeURIComponent(data.matchId)}">閱讀已解鎖內容</a><a class="btn btn-secondary" href="index.html">返回首頁</a>`;
        scrubAccessFromAddressBar();
        return;
      }

      if (data.environment === "stage" && data.simulationVerified) {
        if (pollTimer) clearTimeout(pollTimer);
        setState("verified", "ReturnURL 模擬通知驗證成功", "綠界已用 SimulatePaid=1 驗證本站能收到通知；這不是實際付款，因此系統尚未把訂單標記為 paid。可按下方按鈕完成網站端 STAGE 測試解鎖。");
        renderStageVerifiedActions(data.matchId);
        return;
      }

      setState(
        "pending",
        "訂單已建立，等待付款完成",
        data.environment === "stage"
          ? "目前是 STAGE。請至綠界測試後台發送「模擬付款」以驗證 ReturnURL；模擬通知本身不會被視為真實付款。"
          : "尚未收到綠界的真實付款成功通知。完成 ATM／超商繳費後，本頁會持續重新確認。"
      );
      if (pollCount++ < 150) pollTimer = setTimeout(checkStatus, 4000);
    } catch (error) {
      console.error(error);
      setState("error", "暫時無法確認訂單", "請確認網路連線後再按一次「重新確認」；若仍有問題，請聯絡客服並提供訂單編號。");
      renderDefaultActions();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    $("refreshPaymentStatus")?.addEventListener("click", () => { pollCount = 0; checkStatus(); });
    checkStatus();
  });
})();
