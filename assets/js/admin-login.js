(function () {
  const $ = (s) => document.querySelector(s);

  async function request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let body = {};
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(body.error || `HTTP_${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  async function init() {
    const status = $("#adminLoginStatus");
    const form = $("#adminLoginForm");
    const hint = $("#adminSetupHint");

    try {
      const session = await request("/api/admin-session");
      if (!session.configured) {
        status.textContent = "雲端後台尚未完成設定";
        hint.hidden = false;
        form.hidden = true;
        return;
      }
      if (session.authenticated) {
        location.replace("admin.html");
        return;
      }
      status.textContent = "請輸入管理員密碼";
      form.hidden = false;
      hint.hidden = true;
    } catch {
      status.textContent = "目前無法連線至後台 API";
      hint.hidden = false;
      form.hidden = true;
    }
  }

  async function login(e) {
    e.preventDefault();
    const status = $("#adminLoginStatus");
    const button = e.submitter;
    if (button) button.disabled = true;
    status.textContent = "登入中…";

    try {
      await request("/api/admin-login", {
        method: "POST",
        body: JSON.stringify({ password: $("#adminPassword")?.value || "" })
      });
      location.replace("admin.html");
    } catch (err) {
      status.textContent = err.status === 401 ? "密碼錯誤，請重新輸入。" : "登入失敗，請稍後再試。";
      if ($("#adminPassword")) {
        $("#adminPassword").value = "";
        $("#adminPassword").focus();
      }
      if (button) button.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#adminLoginForm")?.addEventListener("submit", login);
    init();
  });
})();