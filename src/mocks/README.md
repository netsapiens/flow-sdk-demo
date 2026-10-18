# Mock fixtures

Static demo data — **not** real data and not fetched from any API. These modules
keep sample content out of the page/component files so those stay focused on UI.

| File                    | Used by                                                                                             | What it is                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `people.ts`             | `crm.ts`                                                                                            | Shared internal directory (extension → name/department). Single source of truth so the same person reads consistently across surfaces.                                                |
| `crm.ts`                | `services/callEnrichment.ts`, `extensions/AnalyticsWidget.tsx`, `pages/liveOperations/`, CRM panels | CRM records (external callers + internal people) with tier and open deal, plus `normalizePhoneNumber` / `lookupCrmRecord` / `findCrmRecord` / `matchCrmParty` / `searchCrmDirectory`. |
| `recentCalls.ts`        | `api/callsApi.ts` (type only)                                                                       | Sample recent calls keyed to the CRM directory, plus the `RecentCall` shape and `formatDuration`. No page renders them today.                                                         |
| `crmConnection.ts`      | `pages/CrmIntegrationPage.tsx`                                                                      | The platform-level CRM connection, per-domain sync state and field mapping the CRM Integration page draws.                                                                            |
| `datagridSample.ts`     | `pages/showcase/sections/DataGridSection.tsx`                                                       | Sample users for the DatagridTemplate example.                                                                                                                                        |
| `callRecordings.ts`     | `recordingQaReviews.ts`, `widgets/RecordedCallsStat.tsx`                                            | 42 recordings generated deterministically from an index, on **fixed** dates so sorting is stable under test.                                                                          |
| `recordingQaReviews.ts` | `pages/RecordingQaReviewPage.tsx`                                                                   | A QA review queue (agent, queue, reviewer, 0–100 score, status, flags, scorecard) over the processed recordings — data the host does not have.                                        |
| `widgetActivity.ts`     | `widgets/RecentActivityWidget.tsx`, `widgets/CallVolumeChart.tsx`                                   | The app's own CRM events, and calls matched to the CRM, built **relative to a caller-supplied `now`** — see below.                                                                    |

> **Why one fixture is relative and the rest are fixed.** `callRecordings.ts`
> (and the QA queue built from it) pins its dates so a table's default sort never shifts under a test run.
> `widgetActivity.ts` cannot: the CRM activity and call volume widgets filter it by
> `widget.range`, the live from/to window a dashboard resolves for its widgets,
> and a fixture pinned to a past month falls outside every preset the range
> control offers — the widget would read as broken rather than as filtered. It
> takes `now` as a parameter rather than reading the clock, so a render stays a
> pure function of its inputs.

> The only **live** data in the demo is the CRM Integration page's call to
> `GET /domains/{domain}/users/{user}/cdrs` via `flowContext.api`.
