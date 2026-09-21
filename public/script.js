(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const params = () => new URLSearchParams(window.location.search);

  const cleanMailbox = value => String(value || "").trim().toLowerCase();

  const validMailbox = mailbox =>
    /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(mailbox);

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));

  const formatDate = value => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  const toast = message => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(window.__zmailToast);
    window.__zmailToast = setTimeout(() => el.classList.remove("show"), 2600);
  };

  async function api(action, options = {}) {
    const init = {
      method: options.method || "GET",
      headers: { Accept: "application/json", ...(options.headers || {}) }
    };

    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(`/api/maildrop?action=${encodeURIComponent(action)}`, init);
    const text = await response.text();

    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { error: text || "Unexpected server response." }; }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }
    return data;
  }

  async function getInbox(mailbox) {
    return api("inbox", { body: undefined, headers: {}, method: "GET" })
      .catch(async firstError => {
        if (firstError) {
          const response = await fetch(`/api/maildrop?action=inbox&mailbox=${encodeURIComponent(mailbox)}`, {
            headers: { Accept: "application/json" }
          });
          const text = await response.text();
          let data;
          try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
          if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
          return data;
        }
      });
  }

  async function getMessage(mailbox, id) {
    const response = await fetch(`/api/maildrop?action=message&mailbox=${encodeURIComponent(mailbox)}&id=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" }
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }

  async function deleteMessage(mailbox, id) {
    return api("delete", {
      method: "POST",
      body: { mailbox, id }
    });
  }

  function extractMessages(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.messages)) return data.messages;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.emails)) return data.emails;
    if (data.data && Array.isArray(data.data.messages)) return data.data.messages;
    return [];
  }

  function messageId(message) {
    return message.id ?? message._id ?? message.messageId;
  }

  function messageSubject(message) {
    return message.subject || message.Subject || "(No subject)";
  }

  function messageFrom(message) {
    return message.from?.address || message.from || message.sender || message.From || "Unknown sender";
  }

  function messageDate(message) {
    return message.date || message.createdAt || message.timestamp || message.created || "";
  }

  function renderMessages(messages, mailbox) {
    const list = $("#message-list");
    if (!list) return;

    list.innerHTML = messages.map(message => {
      const id = messageId(message);
      const subject = escapeHTML(messageSubject(message));
      const from = escapeHTML(messageFrom(message));
      const date = escapeHTML(formatDate(messageDate(message)));

      return `
        <article class="message-card" data-id="${escapeHTML(id)}">
          <div class="message-icon">✉</div>
          <div class="message-info">
            <strong>${subject}</strong>
            <p>${from}</p>
          </div>
          <div class="message-date">${date}</div>
          <div class="message-actions">
            <button class="view-btn" type="button" data-action="view" data-id="${escapeHTML(id)}">View</button>
            <button class="delete-btn" type="button" data-action="delete" data-id="${escapeHTML(id)}">Delete</button>
          </div>
        </article>`;
    }).join("");

    list.dataset.mailbox = mailbox;
  }

  async function loadInbox(mailbox) {
    const loading = $("#loading-state");
    const empty = $("#empty-state");
    const alert = $("#inbox-alert");
    const list = $("#message-list");
    const count = $("#message-count");

    loading?.classList.remove("hidden");
    empty?.classList.add("hidden");
    if (alert) { alert.style.display = "none"; alert.textContent = ""; }

    try {
      const data = await getInbox(mailbox);
      const messages = extractMessages(data);
      renderMessages(messages, mailbox);

      if (count) count.textContent = `${messages.length} message${messages.length === 1 ? "" : "s"}`;
      loading?.classList.add("hidden");

      if (!messages.length) empty?.classList.remove("hidden");
      else empty?.classList.add("hidden");

      document.querySelectorAll("[data-last-refreshed]").forEach(el => {
        el.textContent = `Last checked: ${formatDate(new Date())}`;
      });
    } catch (error) {
      loading?.classList.add("hidden");
      empty?.classList.add("hidden");
      if (alert) {
        alert.textContent = error.message;
        alert.style.display = "block";
      }
    }
  }

  function deleteCard(card) {
    card?.remove();
    const list = $("#message-list");
    const count = $("#message-count");
    const remaining = list ? list.querySelectorAll(".message-card").length : 0;
    if (count) count.textContent = `${remaining} message${remaining === 1 ? "" : "s"}`;
    if (!remaining) $("#empty-state")?.classList.remove("hidden");
  }

  function initLogin() {
    const form = $("#mailbox-form");
    if (!form) return;

    form.addEventListener("submit", event => {
      event.preventDefault();
      const input = $("#mailbox");
      const error = $("#login-error");
      const mailbox = cleanMailbox(input?.value);

      if (!validMailbox(mailbox)) {
        if (error) error.textContent = "Enter a valid mailbox username.";
        input?.focus();
        return;
      }

      if (error) error.textContent = "";
      window.location.href = `/inbox.html?mailbox=${encodeURIComponent(mailbox)}`;
    });
  }

  function initInbox() {
    const list = $("#message-list");
    const mailbox = cleanMailbox(params().get("mailbox"));
    if (!list || !mailbox) return;

    if (!validMailbox(mailbox)) {
      const alert = $("#inbox-alert");
      if (alert) {
        alert.textContent = "Invalid mailbox name.";
        alert.style.display = "block";
      }
      return;
    }

    const name = $("#mailbox-name");
    const address = $("#mailbox-address");
    if (name) name.textContent = mailbox;
    if (address) address.textContent = `${mailbox}@maildrop.cc`;

    const refresh = () => loadInbox(mailbox);
    $("#refresh-page")?.addEventListener("click", refresh);
    $("#refresh-mails")?.addEventListener("click", refresh);
    $$("[data-refresh]").forEach(button => button.addEventListener("click", refresh));

    list.addEventListener("click", async event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const id = button.dataset.id;
      const card = button.closest(".message-card");

      if (button.dataset.action === "view") {
        window.location.href = `/view.html?mailbox=${encodeURIComponent(mailbox)}&id=${encodeURIComponent(id)}`;
        return;
      }

      if (button.dataset.action === "delete") {
        button.disabled = true;
        try {
          await deleteMessage(mailbox, id);
          deleteCard(card);
          toast("Message deleted.");
        } catch (error) {
          button.disabled = false;
          toast(error.message);
        }
      }
    });

    loadInbox(mailbox);
  }

  async function initView() {
    const view = $("#message-view");
    if (!view) return;

    const mailbox = cleanMailbox(params().get("mailbox"));
    const id = params().get("id");
    const loading = $("#view-loading");
    const errorBox = $("#view-error");

    const backUrl = `/inbox.html?mailbox=${encodeURIComponent(mailbox)}`;
    const back = $("#back-to-inbox");
    if (back) back.href = backUrl;

    $("#back-button")?.addEventListener("click", () => { window.location.href = backUrl; });
    $("#error-back")?.addEventListener("click", () => { window.location.href = backUrl; });

    if (!mailbox || !id || !validMailbox(mailbox)) {
      loading?.classList.add("hidden");
      view.classList.add("hidden");
      errorBox?.classList.remove("hidden");
      return;
    }

    try {
      const data = await getMessage(mailbox, id);
      const message = data.message || data.data || data;

      $("#view-subject").textContent = message.subject || "(No subject)";
      $("#view-from").textContent = message.from?.address || message.from || message.sender || "Unknown sender";
      $("#view-date").textContent = formatDate(message.date || message.createdAt || message.timestamp);

      const frame = $("#email-frame");
      const html = message.html || message.bodyHtml || message.body || `<pre>${escapeHTML(message.text || "")}</pre>`;
      frame.srcdoc = html;

      loading?.classList.add("hidden");
      errorBox?.classList.add("hidden");
      view.classList.remove("hidden");

      $("#delete-message")?.addEventListener("click", async () => {
        try {
          await deleteMessage(mailbox, id);
          toast("Message deleted.");
          setTimeout(() => { window.location.href = backUrl; }, 500);
        } catch (error) {
          toast(error.message);
        }
      });
    } catch (error) {
      loading?.classList.add("hidden");
      view.classList.add("hidden");
      errorBox?.classList.remove("hidden");
      const text = $("#view-error-text");
      if (text) text.textContent = error.message;
    }
  }

  function start() {
    initLogin();
    initInbox();
    initView();
  }

  document.addEventListener("DOMContentLoaded", start);
})();
