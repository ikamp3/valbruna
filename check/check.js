// Vallbruna free exposure check, static version for GitHub Pages.
// Accounts + sign-in codes: Supabase. Breach data: XposedOrNot (called from the visitor's browser).
// All text from outside sources is inserted with textContent, never as HTML.
(function () {
  "use strict";

  var XON = "https://api.xposedornot.com/v1";
  var CACHE_MS = 24 * 3600 * 1000;
  var cfg = window.VB_CONFIG || {};
  var configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var demo = !configured && local;
  var sb = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  }) : null;
  var pendingEmail = "";

  function $(id) { return document.getElementById(id); }
  function show(step) {
    ["step-email", "step-code", "step-loading", "step-result", "step-deleted"].forEach(function (s) {
      $(s).hidden = s !== step;
    });
    $("signout").hidden = step !== "step-result";
    window.scrollTo(0, 0);
  }
  function err(id, msg) { var e = $(id); e.textContent = msg || ""; e.hidden = !msg; }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }

  // ---------- auth (Supabase, or a fake in demo mode) ----------
  var DEMO_KEY = "vb_demo_user";
  var auth = {
    sendCode: async function (email) {
      if (demo) return;
      var r = await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
      if (r.error) throw r.error;
    },
    verify: async function (email, code) {
      if (demo) {
        if (!/^\d{6,10}$/.test(code)) throw new Error("bad code");
        try { localStorage.setItem(DEMO_KEY, email); } catch (e) {}
        return email;
      }
      var r = await sb.auth.verifyOtp({ email: email, token: code, type: "email" });
      if (r.error) throw r.error;
      return r.data.user.email;
    },
    currentEmail: async function () {
      if (demo) { try { return localStorage.getItem(DEMO_KEY); } catch (e) { return null; } }
      var r = await sb.auth.getSession();
      return r.data.session ? r.data.session.user.email : null;
    },
    signOut: async function () {
      if (demo) { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} return; }
      await sb.auth.signOut();
    },
    deleteMe: async function () {
      if (demo) { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} return; }
      var r = await sb.rpc("delete_me");
      if (r.error) throw r.error;
      await sb.auth.signOut();
    }
  };

  function friendly(e) {
    var m = String((e && (e.message || e.msg)) || "");
    var status = e && e.status;
    if (status === 429 || /rate|seconds|too many/i.test(m)) return "Please wait a minute before asking for another code.";
    if (/expired|invalid|token/i.test(m)) return "That code is wrong or has expired. Check the email or send a new code.";
    return "Something went wrong. Please try again in a moment.";
  }

  // ---------- breach lookup ----------
  function cacheKey(email) { return "vb_result_" + email; }
  async function lookup(email) {
    try {
      var c = JSON.parse(sessionStorage.getItem(cacheKey(email)) || "null");
      if (c && Date.now() - c.at < CACHE_MS) return c.rows;
    } catch (e) {}
    var r = await fetch(XON + "/breach-analytics?email=" + encodeURIComponent(email));
    if (r.status === 429) { var busy = new Error("busy"); busy.busy = true; throw busy; }
    if (r.status === 404) return [];
    if (!r.ok) throw new Error("HTTP " + r.status);
    var d = await r.json();
    var list = (d && d.ExposedBreaches && d.ExposedBreaches.breaches_details) || [];
    var rows = list.map(function (b) {
      return {
        name: String(b.breach || ""),
        domain: String(b.domain || ""),
        year: /^\d{4}/.test(String(b.xposed_date || "")) ? String(b.xposed_date).slice(0, 4) : "",
        data: String(b.xposed_data || "").split(";").map(function (s) { return s.trim(); }).filter(Boolean)
      };
    }).filter(function (r) { return r.name; });
    rows.sort(function (a, b) { return (b.year || "0").localeCompare(a.year || "0") || a.name.localeCompare(b.name); });
    try { sessionStorage.setItem(cacheKey(email), JSON.stringify({ at: Date.now(), rows: rows })); } catch (e) {}
    return rows;
  }

  var ADVICE = [
    ["password", "Passwords leaked", "Change the password on every site where you used it, starting with email and banking. Turn on two-step login."],
    ["phone", "Phone number leaked", "Expect scam calls and texts that use your name. Your bank will never ask for a code or a transfer on the phone."],
    ["address", "Home address leaked", "Be careful with letters and parcels asking you to pay or call a number."],
    ["birth", "Date of birth leaked", "Scammers use it to sound official. Don't treat it as proof that a caller is genuine."],
    ["credit", "Card details leaked", "Ask your bank for a new card and watch your statements."],
    ["bank", "Bank details leaked", "Tell your bank and watch for unexpected debits."]
  ];

  function render(email, rows) {
    $("result-eyebrow").textContent = "Exposure check · " + email;
    var v = $("verdict"), title = $("verdict-title");
    title.textContent = "";
    if (rows.length) {
      v.className = "verdict bad";
      $("badge").textContent = "Found";
      title.append("Your email is in ", el("em", rows.length + " known breach" + (rows.length === 1 ? "." : "es."), "s"));
      $("verdict-lead").textContent = "This doesn't mean someone is in your accounts. It means scammers may know details about you, and can use them to make fake messages look real.";
    } else {
      v.className = "verdict ok";
      $("badge").textContent = "Not found";
      title.append("Not found in the breaches ", el("em", "we checked.", "s"));
      $("verdict-lead").textContent = "We checked hundreds of known breaches. Others may exist that we can't see, so stay careful with unexpected messages about money.";
    }

    // what leaked
    var counts = {};
    rows.forEach(function (r) { r.data.forEach(function (d) { counts[d] = (counts[d] || 0) + 1; }); });
    var kinds = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 6);
    var ul = $("kinds"); ul.textContent = "";
    kinds.forEach(function (k) { var li = el("li", k + " "); li.append(el("span", "in " + counts[k], "n")); ul.append(li); });
    $("kinds-card").hidden = !kinds.length;

    // advice
    var seen = Object.keys(counts).join(" ").toLowerCase();
    var tips = $("tips"); tips.textContent = "";
    ADVICE.forEach(function (a) {
      if (seen.indexOf(a[0]) >= 0) { var li = el("li"); li.append(el("strong", a[1] + ". "), a[2]); tips.append(li); }
    });
    if (rows.length) {
      var li = el("li");
      li.append(el("strong", "Expect personal phishing. "), "Scammers buy these lists. Emails that know your name or the site you used can still be fake: open the site yourself instead of clicking the link.");
      tips.append(li);
    }
    $("tips-card").hidden = !rows.length;

    // the list
    var tb = $("list").querySelector("tbody"); tb.textContent = "";
    $("list").classList.remove("open");
    rows.forEach(function (r, i) {
      var tr = el("tr"); if (i >= 10) tr.className = "more";
      var td1 = el("td"); td1.append(el("strong", r.name)); if (r.domain) td1.append(el("span", r.domain, "dom"));
      tr.append(td1, el("td", r.year || "–", "mono"), el("td", r.data.length ? r.data.join(", ") : "Not published"));
      tb.append(tr);
    });
    $("list-card").hidden = !rows.length;
    var more = $("show-more");
    more.hidden = rows.length <= 10;
    more.textContent = "Show all " + rows.length;
    show("step-result");
  }

  async function showResult(email) {
    show("step-loading");
    try {
      render(email, await lookup(email));
    } catch (e) {
      render(email, []);
      $("verdict").className = "verdict";
      $("badge").textContent = "Try again soon";
      $("verdict-title").textContent = e && e.busy ? "Busy right now." : "We couldn't check just now.";
      $("verdict-lead").textContent = e && e.busy
        ? "Many people are checking at the moment. Please reload this page in an hour. You're already signed in."
        : "The breach database didn't answer. Please reload this page in a few minutes.";
      $("tips-card").hidden = true;
    }
  }

  // ---------- events ----------
  var EMAIL_RE = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
  $("email-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!configured && !demo) return;
    var email = $("email").value.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      $("email").setAttribute("aria-invalid", "true");
      return err("email-error", "That doesn't look like an email address.");
    }
    $("email").removeAttribute("aria-invalid");
    err("email-error");
    var btn = e.submitter || this.querySelector("button"); btn.disabled = true;
    try {
      await auth.sendCode(email);
      pendingEmail = email;
      $("code-email").textContent = email;
      $("code").value = "";
      err("code-error");
      show("step-code");
      $("code").focus();
    } catch (x) {
      err("email-error", friendly(x));
    } finally { btn.disabled = false; }
  });

  $("code-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var code = $("code").value.replace(/\s+/g, "");
    if (!/^\d{6,10}$/.test(code)) return err("code-error", "Type the number from the email.");
    var btn = e.submitter || this.querySelector("button"); btn.disabled = true;
    try {
      var email = await auth.verify(pendingEmail, code);
      await showResult(email);
    } catch (x) {
      err("code-error", friendly(x));
    } finally { btn.disabled = false; }
  });

  $("resend").addEventListener("click", async function () {
    try { await auth.sendCode(pendingEmail); err("code-error", "A new code is on its way."); }
    catch (x) { err("code-error", friendly(x)); }
  });
  $("change-email").addEventListener("click", function () { show("step-email"); $("email").focus(); });
  $("signout").addEventListener("click", async function () { await auth.signOut(); sessionStorage.clear(); show("step-email"); });
  $("show-more").addEventListener("click", function () { $("list").classList.add("open"); this.hidden = true; });
  $("delete").addEventListener("click", async function () {
    try { await auth.deleteMe(); sessionStorage.clear(); show("step-deleted"); }
    catch (x) { err("delete-error", "We couldn't delete the account just now. Please try again in a moment."); }
  });

  // ---------- start ----------
  (async function start() {
    $("demo-banner").hidden = !demo;
    $("config-banner").hidden = configured || demo;
    if (!configured && !demo) { $("email-form").querySelector("button").disabled = true; return; }
    var email = await auth.currentEmail();
    if (email) showResult(email); else show("step-email");
  })();
})();
