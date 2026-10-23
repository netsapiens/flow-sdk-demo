# flow-sdk-demo — project rules

This is a Module Federation **remote** loaded by the Flow host. It is also the
reference partner apps are pointed at, so the code has to model the practice it
teaches, not just work.

## RULE 1 (MAJOR): Never hand-roll UI

**Every visible element must come from the host component kit the SDK hands over
in `flowContext.ui` — `ui.*` components and `ui.templates.*`. No exceptions
outside the carve-outs below.**

Concretely, in `src/`:

- **Never** write a styled DOM element — no `<div style={...}>`, `<button
style={...}>`, `<h2>`, `<table>`, `<pre>`. Use `Box`, `Button`, `Typography`,
  `Paper`, `Card`, `Chip`, `Alert`, `Tabs`, `Divider`,
  `templates.DatagridTemplate`, `templates.PageTemplate`, and the rest.
- **Never paint a color from `ui.theme` or `ui.styles`.** `ui.theme`
  (`ThemeTokens`) and `ui.styles` (`UIStyles` — `surface.card`, `text.muted`,
  `badge.primary`, …) are **snapshots whose freshness is not contractual**, and
  a `<div style={ui.styles.surface.card}>` that stops following the dark/light
  toggle is the exact bug that motivated this rule. The mechanism is worth
  knowing, because it is easy to reintroduce:

  - The host keeps one frozen `ui` surface **per color mode** and rebuilds the
    whole context when the mode changes (`createFlowUi(mode)` in its
    `FlowAppsLoader`). So the host hands over correct tokens.
  - The SDK's recommended `useMemo([], …)` wrapper pattern in `App.tsx`
    **freezes the context** to keep component identity stable, so the rebuilt
    context never reaches `FlowContextProvider`.
  - The provider therefore keeps `theme`, `locale`, `managing` and `ui` live
    from host events. `ui` arrives on `theme:changed` (`{ theme, ui }`); on a
    host too old to send it, `ui.theme`/`ui.styles` stay pinned to the mode
    that was active on first paint while `theme` keeps updating around them.

  Do **not** treat a live `ui` as permission to style from tokens: it depends
  on the host version, and inline token styling still skips the focus rings,
  hover states and a11y the kit components carry.

- Colors belong in `sx`, as **palette paths** the host resolves at render:
  `color='text.secondary'`, `borderColor='divider'`, `borderLeftColor='primary.main'`,
  `bgcolor='background.paper'`. These follow the toggle for free.
- Need spacing, radius, or a font size? Prefer `sx` shorthands (`p`, `mb`,
  `gap`, `spacing`). Reading `ui.theme.spacing` / `.typography` /
  `.borderRadius` is _safe_ (mode-independent) but rarely worth it.
- The one reactive theme signal is `useTheme()` from the SDK. Use it only to
  **pick** something (an icon, a `grey.900` vs `grey.50` background), never to
  rebuild styling the kit already does. Nothing in `src/` needs it today: the
  one place that did was a hand-rolled code block, now `ui.Code`.
- Missing a component? Say so and pick the nearest kit primitive, with every color
  still from `sx`. Do not fill a gap with hand-styled markup — and check the list
  below before deciding it is a gap. `src/pages/demo/PatternsPanel.tsx` once built
  a table out of `Box component='table' | 'tr' | 'td'` because this file used to
  say the kit had no `Table`; it has one.

### What the kit has

Verified against the host's `src/lib/sdk/ui/flowUi.ts`. Forty-one components on
`ui`, plus nine shells on `ui.templates`:

```
ActivityList  Alert  Autocomplete  Avatar  Box  Button  Card  CardContent
Chart  Checkbox  Chip  Code  Divider  Donut  FormControlLabel  FormLabel
Grid  Icon  IconButton  List  ListItem  ListItemText  Paper  Radio
RadioGroup  SearchField  Select  Stack  StatBlock  Switch  Table  TableBody
TableCell  TableHead  TableRow  Tabs  TextField  ToggleButton
ToggleButtonGroup  Tooltip  Typography

templates: PageTemplate  PageTemplateWithExtensions  FormTemplate  FormPanel
           SidePanel  DatagridTemplate  DashboardTemplate  CarouselTemplate
           SideTrayComponents
```

`src/pages/ComponentShowcasePage.tsx` renders every one of them with a live demo
and a snippet — read that before writing anything new.

### What it genuinely does not have

| Wanted                        | Use instead                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `CardActionArea`              | `Card` with `onClick` — the host renders one internally, keyboard-reachable   |
| `Dialog` / `Drawer`           | `templates.SidePanel`, the platform's own right-hand drawer                   |
| `Menu`                        | nothing yet; say so rather than hand-rolling a popper                         |
| `Accordion`                   | nothing yet                                                                   |
| `Badge`, `Skeleton`, progress | nothing yet — a widget's loading state is the host's job, via `refreshPolicy` |
| `Snackbar`                    | nothing yet; `Alert` in place, or the host's own notifications                |

> **This table was wrong for a while, and it cost real work.** It used to list
> `Table`, `Grid`, `List` and a `Code` block as missing, long after the host
> started shipping all four. On that advice `src/pages/demo/PatternsPanel.tsx`
> hand-rolled a table through `Box component='table'` and a `CodeBlock` component
> duplicated `ui.Code`; both have since been replaced with the kit's own. If you
> find yourself about to build a primitive, check `flowUi.ts` first — this file
> is a copy and copies go stale.

### Carve-outs (the only ones)

1. **Kit-unavailable fallbacks.** The bare `<div style={{ padding: 24 }}>UI
components not available</div>` at the top of a page component — by
   definition the kit isn't there. Keep these minimal and uncolored.
2. **The headless root** in `src/App.tsx` (`<div style={{ display: 'none' }}>`),
   which renders nothing visible.
3. **Inline text semantics** inside a `Typography`/`Box` — `<strong>`, `<em>`,
   `<code>`, `<li>`. They carry no color of their own and inherit from the host
   component above them.
4. **The highlight overlay** in `src/integration/highlightExtensions.ts`, a
   presenter tool approved for UGM 2026. It draws plain DOM outlines and zone
   labels over the host page, in one fixed orange, so a demo or a screenshot shows
   which pieces are this app's and which are Flow's. It sits above the page and
   ignores the pointer; it is not app UI. Keep it to that one module. Its toggle
   (`TopbarHighlightToggle`) is an ordinary kit button.

### Checking your work

```bash
# should only ever match the carve-outs above
grep -rn -E '<(div|span|p|h[1-6]|button|table|pre|ul|ol) ' --include='*.tsx' src
grep -rn -e 'ui.styles' -e 'ui.theme' -e 'surface\.' -e 'badge\.' --include='*.tsx' src
```

Then `npm run typecheck && npm run lint && npm run format && npm run build`.

## Repo conventions

- **No direct MUI dependency.** Every component comes through
  `flowContext.ui`; keeping MUI out of the remote bundle is the point of that
  surface.
- Page components destructure the kit and guard before rendering (`if (!Paper ||
!Typography) return null`) — see `src/pages/showcase/sections/` for the house
  pattern to copy.
- **Page cards are `rounded`.** Every `Paper` and `Card` the demo draws on its
  own pages takes `rounded` (SDK 0.3.2), so a page's cards read the same. Not
  in `src/widgets/` or `src/extensions/`: those sit inside host surfaces —
  dashboard cards and host panels — which are square.
- Panels inside a page read the live context themselves via
  `useFlowContext()`. Do not prop-drill `ui` / `theme` / `styles` down —
  drilling is how a stale snapshot spreads.
- The `useMemo([], …)` page wrappers in `src/App.tsx` close over
  `flowContext` directly, exactly as the SDK README shows. Do not add a ref
  or re-read to "refresh" it — the provider keeps the live fields current from
  host events, and a workaround here would hide a regression there.
- Static page copy lives in `src/content/`; a page file is layout only.
- Scaffolding a new Flow app? Use the `create-flow-app` skill in
  `.claude/skills/`, which carries the current SDK shape and theming rules.
