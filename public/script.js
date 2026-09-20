(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function getParams() {
    return new URLSearchParams(location.search);
  }

  function cleanMailbox(value) {
    return String(value || "").trim().toLowerCase().replace(/@maildrop\.cc$/i, "");
  }

  function validMailbox(value) {
    return /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function formatDate(value) {
    if (!value) return "Unknown date";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(d);
  }

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
  }

  async function api(action, options = {}) {
    const params = new URLSearchParams({ action });
    const response = await fetch(`/api/maildrop?${params}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });

    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Server returned HTTP ${response.status}`); }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  // Login page
  const loginForm = $("#mailbox-form");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const input = $("#mailbox");
      const error = $("#login-error");
      const mailbox = cleanMailbox(input.value);

      if (!validMailbox(mailbox)) {
        error.hidden = false;
        error.textContent = "Enter a valid mailbox name using letters, numbers, dots, hyphens, or underscores.";
        return;
      }

      error.hidden = true;
      location.href = `/inbox.html?mailbox=${encodeURIComponent(mailbox)}`;
    });
  }

  // Inbox page
  const messageList = $("#message-list");
  if (messageList) {
    const mailbox = cleanMailbox(getParams().get("mailbox"));

    if (!validMailbox(mailbox)) {
      location.replace("/login.html");
      return;
    }

    $("#mailbox-name").textContent = mailbox;
    $("#mailbox-address").textContent = `${mailbox}@maildrop.cc`;

    async function loadInbox(showLoading = true) {
      const loading = $("#loading-state");
      const empty = $("#empty-state");
      const alert = $("#inbox-alert");

      if (showLoading) {
        loading.hidden = false;
        empty.hidden = true;
        messageList.hidden = true;
      }

      alert.hidden = true;

      try {
        const data = await api("inbox", { body: { mailbox } });
        const messages = Array.isArray(data.messages) ? data.messages : [];

        loading.hidden = true;
        $("#message-count").textContent = messages.length;

        if (!messages.length) {
          empty.hidden = false;
          messageList.hidden = true;
          return;
        }

        empty.hidden = true;
        messageList.hidden = false;
        messageList.innerHTML = messages.map(message => {
          const id = escapeHTML(message.id);
          return `
            <article class="message-card" data-message-id="${id}">
              <div class="message-icon">✉</div>
              <div class="message-info">
                <h3>${escapeHTML(message.subject || "(No subject)")}</h3>
                <p>${escapeHTML(message.headerfrom || "Unknown sender")}</p>
              </div>
              <div class="message-date">${escapeHTML(formatDate(message.date))}</div>
              <div class="message-actions">
                <button class="small-btn view-btn" type="button">View</button>
                <button class="small-btn danger delete-btn" type="button">Delete</button>
              </div>
            </article>
          `;
        }).join("");
      } catch (err) {
        loading.hidden = true;
        empty.hidden = true;
        messageList.hidden = true;
        alert.hidden = false;
        alert.textContent = err.message;
      }
    }

    async function deleteMessage(id, card) {
      if (!id) return;
      const button = $(".delete-btn", card);
      if (button) {
        button.disabled = true;
        button.textContent = "Deleting…";
      }

      try {
        const data = await api("delete", {
          method: "POST",
          body: { mailbox, id }
        });

        if (!data.deleted) {
          throw new Error("Maildrop did not confirm that the message was deleted.");
        }

        card.remove();
        const remaining = $$(".message-card", messageList).length;
        $("#message-count").textContent = remaining;

        if (!remaining) {
          messageList.hidden = true;
          $("#empty-state").hidden = false;
        }

        toast("Message deleted successfully.");
      } catch (err) {
        if (button) {
          button.disabled = false;
          button.textContent = "Delete";
        }
        toast(err.message);
      }
    }

    messageList.addEventListener("click", e => {
      const card = e.target.closest(".message-card");
      if (!card) return;
      const id = card.dataset.messageId;

      if (e.target.closest(".view-btn")) {
        location.href = `/view.html?mailbox=${encodeURIComponent(mailbox)}&id=${encodeURIComponent(id)}`;
      }

      if (e.target.closest(".delete-btn")) {
        deleteMessage(id, card);
      }
    });

    $("#refresh-page")?.addEventListener("click", () => loadInbox(true));
    $("#refresh-mails")?.addEventListener("click", () => loadInbox(true));
    $("[data-refresh]")?.addEventListener("click", () => loadInbox(true));

    loadInbox(true);
  }

  // View page
  const messageView = $("#message-view");
  if (messageView) {
    const params = getParams();
    const mailbox = cleanMailbox(params.get("mailbox"));
    const id = params.get("id");

    const inboxUrl = validMailbox(mailbox)
      ? `/inbox.html?mailbox=${encodeURIComponent(mailbox)}`
      : "/login.html";

    $("#back-to-inbox").href = inboxUrl;
    $("#back-button").href = inboxUrl;
    $("#error-back").href = inboxUrl;

    if (!validMailbox(mailbox) || !id) {
      $("#view-loading").hidden = true;
      $("#view-error").hidden = false;
      $("#view-error-text").textContent = "The mailbox or message ID is missing.";
      return;
    }

    async function loadMessage() {
      try {
        const data = await api("message", { body: { mailbox, id } });
        const message = data.message;

        $("#view-loading").hidden = true;
        messageView.hidden = false;
        $("#view-subject").textContent = message.subject || "(No subject)";
        $("#view-from").textContent = message.headerfrom || "Unknown sender";
        $("#view-date").textContent = formatDate(message.date);

        const frame = $("#email-frame");
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open();
        doc.write(message.html || "<p>No HTML content was supplied.</p>");
        doc.close();
      } catch (err) {
        $("#view-loading").hidden = true;
        $("#view-error").hidden = false;
        $("#view-error-text").textContent = err.message;
      }
    }

    $("#delete-message")?.addEventListener("click", async e => {
      const button = e.currentTarget;
      button.disabled = true;
      button.textContent = "Deleting…";

      try {
        const data = await api("delete", {
          method: "POST",
          body: { mailbox, id }
        });

        if (!data.deleted) throw new Error("Maildrop did not confirm deletion.");
        toast("Message deleted successfully.");
        setTimeout(() => location.href = inboxUrl, 500);
      } catch (err) {
        button.disabled = false;
        button.textContent = "Delete message";
        toast(err.message);
      }
    });

    loadMessage();
  }
})();