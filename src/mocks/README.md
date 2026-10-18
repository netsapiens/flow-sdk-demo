# Mock fixtures

Static demo data — **not** real data and not fetched from any API. These modules
keep sample content out of the page/component files so those stay focused on UI.

| File                    | Used by                                                  | What it is                                                                                                                                     |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `people.ts`             | `crm.ts`                                                 | Shared internal directory (extension → name/department). Single source of truth so the same person reads consistently across surfaces.         |
| `crm.ts`                | `services/callEnrichment.ts`, `pages/CrmIntegrationPage` | CRM records (external callers + internal people), plus `normalizePhoneNumber` / `lookupCrmRecord`.                                             |
| `recentCalls.ts`        | `pages/CrmIntegrationPage.tsx`                           | Sample recent calls keyed to the CRM directory, shown alongside the user's live calls. Includes `formatDuration`.                              |
| `datagridSample.ts`     | `pages/showcase/sections/DataGridSection.tsx`            | Sample users for the DatagridTemplate example.                                                                                                 |
| `callRecordings.ts`     | `recordingQaReviews.ts`, `widgets/RecordedCallsStat.tsx` | 42 recordings generated deterministically from an index, on **fixed** dates so sorting is stable under test.                                   |
| `recordingQaReviews.ts` | `pages/RecordingQaReviewPage.tsx`                        | A QA review queue (agent, queue, reviewer, 0–100 score, status, flags, scorecard) over the processed recordings — data the host does not have. |
| `widgetActivity.ts`     | `widgets/RecentActivityWidget.tsx`                       | Call activity built **relative to a caller-supplied `now`** — see below.                                                                       |

> **Why one fixture is relative and the rest are fixed.** `callRecordings.ts`
> (and the QA queue built from it) pins its dates so a table's default sort never shifts under a test run.
> `widgetActivity.ts` cannot: the Recent Activity widget filters it by
> `widget.range`, the live from/to window a dashboard resolves for its widgets,
> and a fixture pinned to a past month falls outside every preset the range
> control offers — the widget would read as broken rather than as filtered. It
> takes `now` as a parameter rather than reading the clock, so a render stays a
> pure function of its inputs.

> The only **live** data in the demo is the CRM Integration page's call to
> `GET /domains/{domain}/users/{user}/cdrs` via `flowContext.api`.
