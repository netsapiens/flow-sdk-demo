# Remote-auth vendor backend (reference)

A runnable reference for the **vendor/server side** of the Flow `remoteAuth`
flow. The browser-side extension calls `auth.requestRemoteAuth(...)` (see the
**Remote Auth** tab in the demo app); the NetSapiens API then POSTs a signed,
single-use authorization **code** to your registered callback endpoint. This server is what
receives that webhook and turns it into a vendor token.

What this backend does: verifies the `sha256=` HMAC over
`"<X-NS-Timestamp>." + the raw body` (signature v2), refuses a replayed
`request_id`, verifies the optional `X-NS-Cluster-Verification` JWT when it is
present, posts the PKCE code and verifier to the **pinned** token endpoint, and
shapes the response. What the platform does: signs and delivers the webhook,
and at its token endpoint checks `SHA-256(code_verifier)` against the `S256`
`code_challenge` stored on the code. This backend presents the verifier; it
does not check it, and nothing here reads `X-NS-Platform-Assertion`.

## What it does

```
NetSapiens API ── POST registered callback (signed code) ──▶  this server
                                                       │ 1. verify X-NS-Signature HMAC (required)
                                                       │    + X-NS-Cluster-Verification JWT (if present)
                                                       │ 2. exchange code (PKCE) at
                                                       │    validation_endpoint → NS token
                                                       │ 3. mint VENDOR token for the PROVEN user
                                                       ▼
NetSapiens API ◀──── 2xx { access_token, ... } ───────┘
   │ shapes into RemoteAuthResponse, resolves the extension's promise
```

### The webhook you receive

Headers:

```
X-NS-Request-ID: remauth_<uniqid>
X-NS-Timestamp: <unix seconds>
X-NS-Signature: sha256=<HMAC_SHA256("<X-NS-Timestamp>." + <raw body>, secret)>
X-NS-Signature-Version: 2
X-NS-Platform-Assertion: <RS256 JWT signed by the calling cluster — not read by this reference>
X-NS-Cluster-Verification: <RS256 JWT signed by INSight — may be absent>
```

Body:

```json
{
  "request_id": "remauth_66542d5f3a1b28.12345678",
  "code": "<authorization code>",
  "code_verifier": "<PKCE verifier — only the vendor sees it>",
  "user": {
    "uid": "1042@acme.example.com",
    "domain": "acme.example.com",
    "displayName": "Alice Example"
  },
  "expires_in": 600,
  "validation_endpoint": "https://acme.example.com/oauth2/token",
  "timestamp": 1716720479,
  "pkce_enabled": true,
  "signature": "<duplicate of X-NS-Signature value>"
}
```

### The three things you MUST do

1. **Verify authenticity** (`lib/verify.js`). The HMAC (`X-NS-Signature`) is the
   **required** gate — it proves the sender holds your app's shared secret, and a
   webhook that fails or omits it is rejected. **Signature v2:** it is computed
   over `"<X-NS-Timestamp>." + the RAW request body` — `server.js` mounts
   `express.raw` on the callback route so the handler gets the bytes as sent,
   and parses JSON only after they verify, because `JSON.stringify(req.body)`
   re-serializes and will not match (and an unsigned caller should never reach
   a parser). A stale timestamp
   is rejected too; it is inside the signed string, so that is what stops a
   captured webhook being replayed, together with the replay guard on the
   signed `request_id` (see Production notes). The `X-NS-Cluster-Verification`
   JWT (RS256, signed by INSight, verified against its published JWKS) is an
   additive attestation that the cluster is _entitled_ to the app. It needs a
   live INSight call and can legitimately be absent, so verify it **when
   present** (reject on failure) and proceed on the HMAC when it is not. It is
   optional and replayable (not bound to this request) and this reference
   checks no audience on it; set `aud` when INSight publishes one. It is not a
   second gate: the HMAC and the replay guard are what keep a captured webhook
   out. `X-NS-Platform-Assertion` also arrives; this reference does not read it.
2. **Exchange the code with PKCE** (`lib/exchange.js`) — `POST` to the
   **pinned** `FLOW_TOKEN_ENDPOINT` (the webhook's `validation_endpoint` must
   agree with it, see Production notes), form-encoded with
   `grant_type=authorization_code`, `code`, `code_verifier`, `username=user.uid`,
   and `redirect_uri` (when configured). No `client_id`/`client_secret`. The
   `S256` check of the verifier against the stored `code_challenge` happens on
   the platform's token endpoint, not here. The NS token it returns proves the
   user's identity — **use the identity from this response**, not from the
   webhook body.
3. **Mint your own vendor token** (`lib/token.js`) and return it as
   `{ access_token, token_type, expires_in, refresh_token? }`. The platform maps
   that onto the SDK's `RemoteAuthResponse` via an **explicit allow-list**:
   `access_token → accessToken`, `token_type → tokenType`
   (default `Bearer`), `expires_in → expiresAt` (absolute unix seconds,
   `time() + expires_in`), `refresh_token → refreshToken`, and
   `cluster_verification → clusterVerification` — each only if present. `vendorId`
   and a NetSapiens `user` block are added by the platform from the request/session.
   **Any other field you return is dropped** — there is no generic `metadata`
   pass-through today.

> **Identity comes from the code exchange, not the webhook body.** ns-api pins
> the auth code to the caller's **trusted session** and validates `username` at
> exchange, so the exchange response is the authoritative identity. The body's
> `user.uid` is attacker-influenceable — this reference uses it only as a
> display-name fallback and binds the minted token to `nsToken.uid`/`login`.

## Run

```bash
npm install
cp .env.example .env   # fill in FLOW_CALLBACK_SECRET, FLOW_APP_ID, VENDOR_JWT_SECRET and FLOW_TOKEN_ENDPOINT (all required; the last pins the cluster's token endpoint, and the server refuses to redeem a code without it)
openssl rand -hex 32   # run twice: one value for VENDOR_JWT_SECRET, one for FLOW_CALLBACK_SECRET (32+ characters each, see Production notes)
node --env-file=.env server.js   # Node 20+ ; or: export the vars and `npm start`
```

The server listens on `PORT` (default 8787) at `CALLBACK_PATH`
(default `/flow/callback`). Register `https://<your-host>:8787/flow/callback`
as the app's callback URL, and put its hostname on the app's allowed-hostnames
list in Registered Apps.

## Local smoke test (no NetSapiens cluster)

`MOCK_MODE=1` skips the live code exchange (and, with no cluster, runs without a
cluster-JWT header) so you can exercise HMAC verification + response shaping
locally. **Never set it in production.**

```bash
# both terminals — the same callback secret (32+ characters; a short or
# placeholder value is refused at boot)
export FLOW_CALLBACK_SECRET=$(openssl rand -hex 32)   # then paste the value into terminal 2

# terminal 1 — server in mock mode
VENDOR_JWT_SECRET=$(openssl rand -hex 32) MOCK_MODE=1 npm start

# terminal 2 — POST a correctly-signed mock webhook
npm run sign
```

Expected: `status: 200` and a JSON body with a freshly minted
`access_token`. Flip the secret in either terminal and you'll get
`401 invalid_signature` — the HMAC check working.

## Production notes

- Keep `FLOW_CALLBACK_SECRET` and `VENDOR_JWT_SECRET` out of source control.
- Terminate TLS in front of this (`callbackUrl` must be HTTPS).
- The auth code is single-use and short-lived (`expires_in`); exchange it
  promptly and return within the platform's `remote_timeout_seconds`.
- This issues a self-signed JWT for illustration. Swap `lib/token.js` for however
  your product really issues tokens/sessions.
- `FLOW_TOKEN_ENDPOINT` pins where the code is posted, and the exchange refuses
  to run without it. Its form is **`https://<cluster-host>/ns-api/v2/oauth2/token`**:
  scheme, host and path only, no query or trailing slash. The webhook's
  `validation_endpoint` must agree on origin and path (`lib/exchange.js`
  compares them with `new URL()`, after rewriting `/oauth/token` to
  `/oauth2/token`, since ns-api advertises the former and the live route is the
  latter; either spelling works in the pin, and a trailing slash or query on
  the advertised value is ignored). `https://` is required: `http://localhost`
  or `http://127.0.0.1` is accepted for a local mock cluster only when
  `NODE_ENV` is not `production`. The code is posted with `redirect: 'error'`
  and a 10 s timeout, so a redirect from the endpoint never re-posts it
  elsewhere and a hung endpoint does not hold the webhook open.
- `VENDOR_JWT_SECRET` and `FLOW_CALLBACK_SECRET` are **required**: the server
  refuses to start (`lib/config.js`) if either is unset, shorter than 32
  characters, or contains a placeholder word (`example`, `changeme`,
  `placeholder`, `insecure`), since a weak signing secret lets anyone forge
  trusted tokens and a public callback secret lets anyone sign a webhook. The
  values shipped in `.env.example` are placeholders and are refused.
- The replay guard (`lib/replay.js`) keys on the **signed** `request_id` in the
  body, never on the `X-NS-Request-ID` header (the HMAC does not cover headers).
  Its map is in-memory and **per process**: a restart forgets every id, and a
  backend with several instances must keep it in a shared store (a Redis SET
  with a TTL, or a unique-indexed table). An id is released when the handshake
  fails before a token is minted, so the platform's retry can succeed.
- The HMAC is the required gate; the `X-NS-Cluster-Verification` JWT is sent
  **best-effort** (it depends on a live INSight fetch and cluster config). Verify
  it **when present** and reject on failure — a genuine cluster sends a valid one
  — but don't require its presence, or you'll reject legitimate webhooks from
  clusters that don't emit it. It is optional and replayable, and no audience
  is checked; set `aud` when INSight publishes one. `MOCK_MODE=1` skips it and
  the exchange, so with a real `VENDOR_JWT_SECRET` it mints a token for any
  `user.uid` in a signed body: never set it in production.

## If the webhook never arrives

Your server not being called at all is the common first failure, and it is
almost always registration rather than code — the platform validates the request
before it makes any outbound call.

Check, in this order:

1. **Allowed callback hostnames** — a **comma-separated** list of origins, not a
   JSON array. `https://api.example.com`, not `["https://api.example.com"]`; the
   latter is read as one hostname including the brackets and matches nothing.
   Origin only — no path.
2. **Remote auth enabled** on the app registration.
3. **Callback secret** matches the value this server verifies with. A mismatch
   _does_ reach your server, and shows up as `401 invalid_signature` — so if you
   see that, the wiring is right and only the secret is wrong.
4. **Reachability** — the platform calls you from the internet, so the endpoint
   has to resolve publicly over HTTPS. `curl https://<host>/health` from
   somewhere outside your network before assuming anything else.

If the JWT header is absent but the HMAC passes, that is not your bug: the
cluster could not obtain a verification token, which is operator-side
configuration. Verify when present, don't require it.
