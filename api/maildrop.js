const MAILDROP_URL = "https://api.maildrop.cc/graphql";

function send(res, status, body) {
  res.status(status);
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
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

function debugLog(label, value) {
  const prefix = `[ZMAIL DROP][MAILDROP] ${label}`;
  if (typeof value === "string") {
    console.log(prefix, value);
  } else {
    console.log(prefix, JSON.stringify(value, null, 2));
  }
}

async function graphql(query, variables = {}, meta = {}) {
  const requestBody = { query, variables };

  console.log("============================================================");
  console.log("[ZMAIL DROP][MAILDROP] OUTGOING REQUEST");
  console.log("[ZMAIL DROP][MAILDROP] Time:", new Date().toISOString());
  console.log("[ZMAIL DROP][MAILDROP] Operation:", meta.operation || "unknown");
  console.log("[ZMAIL DROP][MAILDROP] Endpoint:", MAILDROP_URL);
  console.log("[ZMAIL DROP][MAILDROP] Query:");
  console.log(query);
  console.log("[ZMAIL DROP][MAILDROP] Variables:");
  console.log(JSON.stringify(variables, null, 2));

  let response;
  let rawText = "";

  try {
    response = await fetch(MAILDROP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(requestBody),
      cache: "no-store"
    });

    rawText = await response.text();
  } catch (error) {
    console.error("[ZMAIL DROP][MAILDROP] NETWORK ERROR:", error);
    throw new Error(`Maildrop network request failed: ${error.message}`);
  }

  console.log("[ZMAIL DROP][MAILDROP] HTTP STATUS:", response.status);
  console.log("[ZMAIL DROP][MAILDROP] HTTP OK:", response.ok);
  console.log("[ZMAIL DROP][MAILDROP] RAW RESPONSE:");
  console.log(rawText);

  let parsed = null;

  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    console.error("[ZMAIL DROP][MAILDROP] JSON PARSE ERROR:", error);
    throw new Error(
      `Maildrop returned non-JSON data (HTTP ${response.status}): ${rawText.slice(0, 1000)}`
    );
  }

  console.log("[ZMAIL DROP][MAILDROP] PARSED RESPONSE:");
  console.log(JSON.stringify(parsed, null, 2));

  if (parsed?.errors?.length) {
    console.error("[ZMAIL DROP][MAILDROP] GRAPHQL ERRORS:");
    console.error(JSON.stringify(parsed.errors, null, 2));
  }

  console.log("[ZMAIL DROP][MAILDROP] GRAPHQL DATA:");
  console.log(JSON.stringify(parsed?.data ?? null, null, 2));

  if (!response.ok) {
    throw new Error(`Maildrop HTTP ${response.status}`);
  }

  if (parsed?.errors?.length) {
    throw new Error(
      parsed.errors.map(error => error?.message || "Unknown GraphQL error").join("; ")
    );
  }

  console.log("[ZMAIL DROP][MAILDROP] REQUEST SUCCESS");
  console.log("============================================================");

  return {
    data: parsed?.data,
    diagnostics: {
      httpStatus: response.status,
      httpOk: response.ok,
      rawResponse: rawText,
      parsedResponse: parsed
    }
  };
}

module.exports = async function handler(req, res) {
  const startedAt = Date.now();
  const action = String(req.query.action || "").toLowerCase();

  console.log("\n\n############################################################");
  console.log("[ZMAIL DROP] VERCEL FUNCTION START");
  console.log("[ZMAIL DROP] Time:", new Date().toISOString());
  console.log("[ZMAIL DROP] Method:", req.method);
  console.log("[ZMAIL DROP] Action:", action);
  console.log("[ZMAIL DROP] Query:", JSON.stringify(req.query, null, 2));

  try {
    if (req.method === "GET" && action === "inbox") {
      const mailbox = String(req.query.mailbox || "").trim().toLowerCase();

      console.log("[ZMAIL DROP] INBOX REQUEST");
      console.log("[ZMAIL DROP] Mailbox:", mailbox);

      if (!validMailbox(mailbox)) {
        console.error("[ZMAIL DROP] INVALID MAILBOX:", mailbox);
        return send(res, 400, {
          ok: false,
          error: "Invalid mailbox name.",
        });
      }

      const query = `
        query ($mailbox: String!) {
          inbox(mailbox: $mailbox) {
            id
            headerfrom
            subject
            date
          }
        }
      `;

      const result = await graphql(query, { mailbox }, {
        operation: "inbox"
      });

      const messages = result.data?.inbox || [];

      console.log("[ZMAIL DROP] MAILBOX:", mailbox);
      console.log("[ZMAIL DROP] MESSAGES FOUND:", messages.length);
      console.log("[ZMAIL DROP] INBOX DATA:");
      console.log(JSON.stringify(messages, null, 2));
      console.log("[ZMAIL DROP] TOTAL TIME:", `${Date.now() - startedAt}ms`);

      return send(res, 200, {
        ok: true,
        mailbox,
        messages
      });
    }

    if (req.method === "GET" && action === "message") {
      const mailbox = String(req.query.mailbox || "").trim().toLowerCase();
      const id = String(req.query.id || "");

      console.log("[ZMAIL DROP] MESSAGE REQUEST");
      console.log("[ZMAIL DROP] Mailbox:", mailbox);
      console.log("[ZMAIL DROP] Message ID:", id);

      if (!validMailbox(mailbox) || !validId(id)) {
        console.error("[ZMAIL DROP] INVALID MESSAGE REQUEST");
        return send(res, 400, {
          ok: false,
          error: "Invalid mailbox or message ID.",
        });
      }

      const query = `
        query ($mailbox: String!, $id: String!) {
          message(mailbox: $mailbox, id: $id) {
            id
            headerfrom
            subject
            date
            html
          }
        }
      `;

      const result = await graphql(query, { mailbox, id }, {
        operation: "message"
      });

      if (!result.data?.message) {
        console.warn("[ZMAIL DROP] MESSAGE NOT FOUND");
        return send(res, 404, {
          ok: false,
          error: "Message not found. It may have expired or already been deleted.",
        });
      }

      console.log("[ZMAIL DROP] MESSAGE FOUND");
      console.log(JSON.stringify(result.data.message, null, 2));

      return send(res, 200, {
        ok: true,
        message: result.data.message
      });
    }

    if (req.method === "POST" && action === "delete") {
      const mailbox = String(req.body?.mailbox || "").trim().toLowerCase();
      const id = String(req.body?.id || "");

      console.log("[ZMAIL DROP] DELETE REQUEST");
      console.log("[ZMAIL DROP] Mailbox:", mailbox);
      console.log("[ZMAIL DROP] Message ID:", id);

      if (!validMailbox(mailbox) || !validId(id)) {
        console.error("[ZMAIL DROP] INVALID DELETE REQUEST");
        return send(res, 400, {
          ok: false,
          error: "Invalid mailbox or message ID.",
        });
      }

      const mutation = `
        mutation ($mailbox: String!, $id: String!) {
          delete(mailbox: $mailbox, id: $id)
        }
      `;

      const deleteResult = await graphql(mutation, { mailbox, id }, {
        operation: "delete"
      });

      console.log("[ZMAIL DROP] DELETE MUTATION RESULT:");
      console.log(JSON.stringify(deleteResult.data, null, 2));

      const verifyQuery = `
        query ($mailbox: String!) {
          inbox(mailbox: $mailbox) {
            id
          }
        }
      `;

      const verifyResult = await graphql(
        verifyQuery,
        { mailbox },
        { operation: "delete-verification" }
      );

      const stillExists = (verifyResult.data?.inbox || [])
        .some(message => message.id === id);

      console.log("[ZMAIL DROP] DELETE VERIFICATION");
      console.log("[ZMAIL DROP] Still exists:", stillExists);
      console.log("[ZMAIL DROP] Verification inbox:");
      console.log(JSON.stringify(verifyResult.data?.inbox || [], null, 2));

      if (stillExists) {
        console.error("[ZMAIL DROP] DELETE FAILED: MESSAGE STILL EXISTS");
        return send(res, 409, {
          ok: false,
          deleted: false,
          error: "Maildrop did not remove the message. The page was not changed.",
        });
      }

      console.log("[ZMAIL DROP] DELETE CONFIRMED");
      console.log("[ZMAIL DROP] TOTAL TIME:", `${Date.now() - startedAt}ms`);

      return send(res, 200, {
        ok: true,
        deleted: true,
        result: deleteResult.data?.delete ?? null
      });
    }

    console.warn("[ZMAIL DROP] UNSUPPORTED OPERATION");
    return send(res, 405, {
      ok: false,
      error: "Unsupported API operation."
    });
  } catch (error) {
    console.error("############################################################");
    console.error("[ZMAIL DROP] FATAL ERROR");
    console.error("[ZMAIL DROP] Message:", error?.message);
    console.error("[ZMAIL DROP] Stack:", error?.stack);
    console.error("[ZMAIL DROP] Duration:", `${Date.now() - startedAt}ms`);
    console.error("############################################################");

    return send(res, 502, {
      ok: false,
      error: error?.message || "Maildrop request failed."
    });
  }
};
