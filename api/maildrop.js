const MAILDROP_URL = "https://api.maildrop.cc/graphql";

function json(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store, max-age=0");
  return res.json(body);
}

function validMailbox(value) {
  return typeof value === "string" &&
    /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value);
}

function validId(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    /^[a-zA-Z0-9._:-]+$/.test(value);
}

async function graphql(query, variables = {}) {
  const response = await fetch(MAILDROP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Maildrop HTTP ${response.status}`);
  }

  if (data?.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }

  return data?.data;
}

module.exports = async function handler(req, res) {
  try {
    const action = String(req.query.action || "").toLowerCase();

    if (req.method === "GET" && action === "inbox") {
      const mailbox = String(req.query.mailbox || "").trim().toLowerCase();

      if (!validMailbox(mailbox)) {
        return json(res, 400, { ok: false, error: "Invalid mailbox name." });
      }

      const data = await graphql(
        `query ($mailbox: String!) {
          inbox(mailbox: $mailbox) {
            id
            headerfrom
            subject
            date
          }
        }`,
        { mailbox }
      );

      return json(res, 200, {
        ok: true,
        mailbox,
        messages: data?.inbox || []
      });
    }

    if (req.method === "GET" && action === "message") {
      const mailbox = String(req.query.mailbox || "").trim().toLowerCase();
      const id = String(req.query.id || "");

      if (!validMailbox(mailbox) || !validId(id)) {
        return json(res, 400, { ok: false, error: "Invalid mailbox or message ID." });
      }

      const data = await graphql(
        `query ($mailbox: String!, $id: String!) {
          message(mailbox: $mailbox, id: $id) {
            id
            headerfrom
            subject
            date
            html
          }
        }`,
        { mailbox, id }
      );

      if (!data?.message) {
        return json(res, 404, { ok: false, error: "Message not found. It may have expired or already been deleted." });
      }

      return json(res, 200, { ok: true, message: data.message });
    }

    if (req.method === "POST" && action === "delete") {
      const mailbox = String(req.body?.mailbox || "").trim().toLowerCase();
      const id = String(req.body?.id || "");

      if (!validMailbox(mailbox) || !validId(id)) {
        return json(res, 400, { ok: false, error: "Invalid mailbox or message ID." });
      }

      // Maildrop's live mutation is intentionally used here because it was
      // confirmed by the project's Termux test before building the UI.
      const data = await graphql(
        `mutation ($mailbox: String!, $id: String!) {
          delete(mailbox: $mailbox, id: $id)
        }`,
        { mailbox, id }
      );

      // Verify against the live inbox after the mutation.
      const verify = await graphql(
        `query ($mailbox: String!) {
          inbox(mailbox: $mailbox) {
            id
          }
        }`,
        { mailbox }
      );

      const stillExists = (verify?.inbox || []).some(message => message.id === id);
      const mutationResult = data?.delete;

      if (stillExists) {
        return json(res, 409, {
          ok: false,
          deleted: false,
          error: "Maildrop did not remove the message. The page was not changed."
        });
      }

      return json(res, 200, {
        ok: true,
        deleted: true,
        result: mutationResult ?? null
      });
    }

    return json(res, 405, { ok: false, error: "Unsupported API operation." });
  } catch (error) {
    console.error("[ZMAIL DROP API]", error);
    return json(res, 502, {
      ok: false,
      error: error?.message || "Maildrop request failed."
    });
  }
};
