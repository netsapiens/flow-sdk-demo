# Remote-auth vendor backend (reference)

A runnable reference for the **vendor/server side** of the Flow `remoteAuth`
flow. The browser-side extension calls `auth.requestRemoteAuth(...)` (see the
**Remote Auth** tab in the demo app); the NetSapiens API then POSTs a signed,
single-use authorization **code** to your registered callback endpoint. This server is what
receives that webhook and turns it into a vendor token.

It implements the NetSapiens remote-auth webhook contract: the `sha256=` HMAC
over `"<X-NS-Timestamp>." + the raw body` (signature v2), the PKCE code exchange (with an `S256`
`code_challenge` check), and the response shaping. The webhook also carries an
`X-NS-Cluster-Verification` JWT, signed by NetSapiens INSight and verifiable
against its published JWKS.

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
X-NS-Platform-Assertion: <RS256 JWT signed by the calling cluster>
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
   over `"<X-NS-Timestamp>." + the RAW request body` — see the `verify` callback in
   `server.js`, which captures the bytes before parsing, because
   `JSON.stringify(req.body)` re-serializes and will not match. A stale timestamp
   is rejected too; it is inside the signed string, so that is what stops a
   captured webhook being replayed. Two RS256 JWTs add secret-less proof:
   `X-NS-Platform-Assertion` (signed by the calling cluster, verified against its
   published JWKS — says _which_ cluster) and `X-NS-Cluster-Verification` (signed
   by INSight — says the cluster is _entitled_ to the app). The second needs a
   live INSight call and can legitimately be absent, so verify it **when present**
   (reject on failure) and proceed on the HMAC when it is not.
2. **Exchange the code with PKCE** (`lib/exchange.js`) — `POST
validation_endpoint` form-encoded with `grant_type=authorization_code`,
   `code`, `code_verifier`, `username=user.uid`, and `redirect_uri` (when
   configured). No `client_id`/`client_secret`. The NS token it returns proves
   the user's identity — **use the identity from this response**, not from the
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
cp .env.example .env   # fill in FLOW_CALLBACK_SECRET, FLOW_APP_ID, VENDOR_JWT_SECRET (required)
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
# terminal 1 — server in mock mode
FLOW_CALLBACK_SECRET=test-secret VENDOR_JWT_SECRET=dev-secret MOCK_MODE=1 npm start

# terminal 2 — POST a correctly-signed mock webhook
FLOW_CALLBACK_SECRET=test-secret npm run sign
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
- `VENDOR_JWT_SECRET` is **required**: the server refuses to start if it's unset
  or a well-known default, since a weak secret lets anyone forge trusted tokens.
- The HMAC is the required gate; the `X-NS-Cluster-Verification` JWT is sent
  **best-effort** (it depends on a live INSight fetch and cluster config). Verify
  it **when present** and reject on failure — a genuine cluster sends a valid one
  — but don't require its presence, or you'll reject legitimate webhooks from
  clusters that don't emit it.

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
