# Calls API helper

`callsApi.ts` fetches the signed-in user's recent call detail records (CDRs) from
the NetSapiens v2 API and normalizes them to the demo's `RecentCall` shape.
It calls the API through the SDK's authenticated proxy (`flowContext.api`) —
credentials never reach the remote app; the host injects auth and audits the call.

## Usage

```ts
import { fetchRecentCalls } from './api/callsApi';

const { api, user } = flowContext;

// GET /domains/{domain}/users/{user}/cdrs, normalized to RecentCall[]
const calls = await fetchRecentCalls(user.domain, user.extension, api);
// [
//   {
//     id: 'live-abc123',
//     party: '+15551234567',     // normalized far-end number/extension
//     direction: 'inbound',
//     timeLabel: '2024-05-26 14:07',
//     durationSeconds: 184,
//     answered: true,
//     source: 'live',
//   },
// ]
```

**No page calls this today.** `CrmIntegrationPage` used to list these calls
beside the matched CRM record, but that repeated the host's own Call Logs page,
so the page became the platform-level CRM connection view instead (3.0.12). The
helper stays as a worked example of a filtered, user-scoped v2 fetch through the
proxy. Each call's `party` is run through `normalizePhoneNumber` (from
`mocks/crm.ts`) so it lines up with the CRM directory keys for matching.

## Exports

| Export                                        | Kind     | Purpose                                                     |
| --------------------------------------------- | -------- | ----------------------------------------------------------- |
| `fetchRecentCalls(domain, userId, apiClient)` | function | Fetch + normalize the user's recent calls to `RecentCall[]` |

## Best-effort field mapping

NetSapiens doesn't expose a single canonical CDR shape across versions, so the
fields are read defensively with fallbacks (`duration` vs `duration-seconds`,
`orig-from-user` vs `orig-from-uri`, etc.). The "other party" is taken from the
far end for the call's direction. This mirrors the best-effort approach the demo
uses elsewhere and keeps the page resilient to schema differences.

## Scope note

This helper is **per-user** because that's what the NetSapiens v2 REST API
exposes (`/domains/{domain}/users/{user}/cdrs`). It exists to demonstrate the
authenticated API proxy, not to be a complete reporting client.
