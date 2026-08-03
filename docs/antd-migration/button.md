# antd `Button` → `Button` mapping guide

**Sweep status:** ledger row `Button` (openmetadata-ui 310, collate-ui 43,
collate-local-webserver 24 — per `docs/antd-migration/LEDGER.md`; also covers
the `antd/lib/button/button-group` ledger row, 5 usages, all in
openmetadata-ui)
**Core component:** `@openmetadata/ui-core-components` →
`components/base/buttons/button` (react-aria based; also exports
`ButtonUtility`, `CloseButton`, `SocialButton`; `ButtonGroup`/`ButtonGroupItem`
live in `components/base/button-group/button-group`)
**Codemod:** `move-named-imports` (import rewrite) + `antd-button-to-core`
(prop rewrite, **to be written** — no transform exists yet; this guide is the
spec for it). Follow the same skip/report conventions as
`transforms/antd-typography-to-core.js` (leave unmappable elements fully
untouched, `console.warn` per skip reason, alias the core import when a file
partially converts).

## Import

| Before | After |
|---|---|
| `import { Button } from 'antd';` | `import { Button } from '@openmetadata/ui-core-components';` |
| `import ButtonGroup from 'antd/lib/button/button-group';` (5 sites, all R1) | `import { ButtonGroup, ButtonGroupItem } from '@openmetadata/ui-core-components';` **only** where the group is genuinely single-select toggle state — see `Button.Group` row below; otherwise replace with a plain flex row of `Button`s |

All non-subpath imports across all three repos use the named form
`import { Button, ... } from 'antd'` — no default-import or namespace-import
variants to handle.

## Prop mapping

| antd prop | core equivalent | notes |
|---|---|---|
| `type="primary"` | `color="primary"` | direct |
| `type="default"` | `color="secondary"` | direct |
| `type="text"` | `color="tertiary"` | direct |
| `type="link"` | `color="link-gray"` (or `link-color`) | design call per context — no mechanical rule distinguishes the two |
| `type="dashed"` | — | 0 occurrences anywhere — drop, no mapping needed |
| `danger` | fold into `color`: `primary`+`danger` → `color="primary-destructive"`, `default`+`danger` → `color="secondary-destructive"`, `text`+`danger` → `color="tertiary-destructive"`, `link`+`danger` → `color="link-destructive"` | **not a rename** — the codemod must read the base `type` first, then branch to the `-destructive` variant; `danger` alone (no explicit `type`) implies antd's default `type="default"` base |
| `size="small"` | `size="xs"` | approved 2026-07-30 — see Size mapping below |
| `size="middle"` | `size="sm"` (core's own default) | approved 2026-07-30 — see Size mapping below |
| `size="large"` | `size="md"` | approved 2026-07-30 — see Size mapping below |
| `ghost` (boolean modifier) | `color="tertiary"` | approved 2026-07-30 — per-site mapping, no new core variant |
| `type="ghost"` (string literal) | `color="tertiary"` | approved 2026-07-30 — same as above |
| `loading` (bare or `={expr}`) | `isLoading` | rename |
| `disabled` (bare or `={expr}`) | `isDisabled` | rename |
| `icon={<X/>}` | `iconLeading={<X/>}` | rename; leading is antd's implicit default position |
| `icon={<Icon component={Svg}/>}` | `iconLeading={Svg}` | the `Icon`/`component` wrapper can be dropped — core accepts the bare `FC<{className}>` |
| `href` / `target` | `href` / `target` | direct — core auto-swaps the rendered element to `AriaLink` when `href` is present, same effect as antd's button-as-link |
| `htmlType` | native `type` | **name swap, not a rename — see inversion warning below** |
| `onClick` / `className` / `autoFocus` | unchanged | native passthrough; any `className` targeting border/shadow must move to `tw:after:outline-*` — see Border-override rule below |

### `htmlType` → `type` inversion warning

Antd's `type` prop is the **visual variant** (`primary`/`default`/`text`/…).
Core's `type` prop is the **native HTML button type**
(`submit`/`reset`/`button`, default `'button'`) — i.e. what antd calls
`htmlType`. These two props occupy the same name on opposite meanings, so a
naive string-rename script that touches `type` alone will silently produce a
core `Button` with `type="primary"` (an invalid/no-op native HTML type) and
no visual variant at all. The codemod must perform **both** rewrites in the
same pass, on every `<Button>` element:

- antd `type="X"` (visual variant) → core `color="<mapped-X>"`
- antd `htmlType="Y"` → core `type="Y"` (only if present; core's default
  `'button'` covers antd's implicit default `htmlType="button"`)

43 (R1) + 7 (R2) + 10 (R3) = 60 `htmlType="submit"` sites; 1 `htmlType="button"`
(R1, redundant with the default); 0 `htmlType="reset"` anywhere.

### Size mapping — approved 2026-07-30

Core has 6 sizes (`xxs | xs | sm | md | lg | xl`, default `'sm'`) vs antd's 3
(`small | middle | large`). Approved mapping (2026-07-30, as proposed):

| antd | core size |
|---|---|
| `small` | `xs` |
| `middle` | `sm` |
| `large` | `md` |

144 (R1) + 13 (R2) + 2 (R3) `size="small"`; 6+0+3 `size="middle"`; 6+0+3
`size="large"`. Additionally **48 dynamic `size={expr}` expressions** (R1:
41, R2: 7) cannot be pattern-matched as literals and need manual per-site
triage regardless of which literal mapping is chosen (example:
`utils/TestConnectionModalUtils.tsx:957`).

## No direct equivalent — do this instead

| antd usage | replacement pattern |
|---|---|
| `shape="circle"` (8 usages: R1 3, R2 5) | Core's icon-only auto-detection (`data-icon-only`) gives a **rounded square, never a true circle** — partial gap. Accept the rounded-square look, or add a `tw:rounded-full` override per site and flag for design review. Example: `components/Entity/EntityLineage/CustomNode.utils.tsx:147` |
| `shape="round"` (pill, 1 usage) | GAP — no pill variant. Example: `components/ActivityFeed/Reactions/Emoji.tsx:116` |
| `block` (25 usages, all R1) | `className="tw:w-full"` — mechanical move, but needs visual QA since it's no longer a first-class prop. Example: `components/NotificationBox/NotificationBox.component.tsx:271` |
| `Button.Group` (5 legacy sites: `ClassificationDetails.tsx:1038`, `GlossaryHeader.component.tsx`, `DataProductsDetailsPage.component.tsx`, `GithubStarCard.component.tsx`, `DomainDetails.component.tsx:1038`) | These group **independent action buttons** (vote/star controls), not single-select toggle state. Core `ButtonGroup`/`ButtonGroupItem` is a react-aria `ToggleButtonGroup` (single-select) — semantic mismatch, not a drop-in. Replace with a plain flex row of `Button`s (`className="tw:flex tw:gap-*"`), one per site, by hand. (5 *already-migrated* core `ButtonGroup` usages exist as precedent in R1 lineage components and 2 in R2 — those are genuine toggle groups and are correct as-is; do not touch) |
| `ref={...}` (5 live usages) | core `Button` is now `forwardRef`-wrapped — **landed in main** (ui-core-components). `<Button ref={...}>` passes through directly; these 5 call sites are unblocked and safe to convert. Sites: `components/Alerts/DestinationFormItem/TeamAndUserSelectItem/TeamAndUserSelectItem.tsx:238`, `components/common/AvatarCarouselItem/AvatarCarouselItem.tsx:62`, plus 3 more (see gap-check §1.9/§4.6) |

## Before / after examples

**1. `type="text"` + `size="small"` (mechanical)**
`utils/ClassificationUtils.tsx:170`

```tsx
// Before
<Button
  className="p-0 flex-center"
  data-testid="edit-button"
  disabled={disableEditButton}
  icon={
    <EditIcon data-testid="editTagDescription" height={14} name="edit" width={14} />
  }
  size="small"
  type="text"
  onClick={() => (handleEditTagClick ? handleEditTagClick(record) : null)}
/>

// After (size mapping per the approved 2026-07-30 table)
<Button
  className="p-0 flex-center"
  color="tertiary"
  data-testid="edit-button"
  iconLeading={
    <EditIcon data-testid="editTagDescription" height={14} name="edit" width={14} />
  }
  isDisabled={disableEditButton}
  size="xs"
  onClick={() => (handleEditTagClick ? handleEditTagClick(record) : null)}
/>
```

**2. `danger` fold-in with `type="default"` + `size="small"` (mechanical once branching is written)**
`components/Settings/Bot/BotDetails/AuthMechanism.tsx:92`

```tsx
// Before
<Button
  danger
  data-testid="revoke-button"
  disabled={!hasPermission}
  size="small"
  type="default"
  onClick={onTokenRevoke}
>
  ...
</Button>

// After
<Button
  color="secondary-destructive"
  data-testid="revoke-button"
  isDisabled={!hasPermission}
  size="xs"
  onClick={onTokenRevoke}
>
  ...
</Button>
```

**3. `block` prop → className move (mechanical, needs visual QA)**
`components/NotificationBox/NotificationBox.component.tsx:271`

```tsx
// Before
<Button block href={viewAllPath} type="link">
  <span>{t('label.view-entity', { entity: t('label.all-lowercase') })}</span>
</Button>

// After
<Button className="tw:w-full" color="link-gray" href={viewAllPath}>
  <span>{t('label.view-entity', { entity: t('label.all-lowercase') })}</span>
</Button>
```

**4. Hand-finish example: `ghost` + `type="primary"` (approved mapping, per-site hand-finish — no codemod)**
`utils/AdvancedSearchUtils.tsx:64`

```tsx
// Before — codemod skips this element entirely; `ghost` is not pattern-matched
<Button
  ghost
  className="action action--ADD-RULE"
  data-testid="advanced-search-add-rule"
  icon={<PlusOutlined />}
  type="primary"
  onClick={props?.onClick}
>
  {t('label.add')}
</Button>

// After — hand-finished using the approved 2026-07-30 ghost mapping
<Button
  className="action action--ADD-RULE"
  color="tertiary"
  data-testid="advanced-search-add-rule"
  iconLeading={<PlusOutlined />}
  onClick={props?.onClick}
>
  {t('label.add')}
</Button>
```

**5. Hand-finish example: `ref` (forwardRef landed in main — unblocked)**
`components/common/AvatarCarouselItem/AvatarCarouselItem.tsx:62`

```tsx
// Before — imperative ref for focus/positioning
<Button
  className={classNames('p-0 m-r-xss avatar-item', { active: isActive })}
  data-testid={`avatar-carousel-item-${avatar.id}`}
  ref={buttonRef}
  shape="circle"
  onClick={handleAvatarClick}
>
  <ProfilePicture name={avatar.name ?? ''} width="28" />
</Button>

// After — ref now passes straight through (core Button is forwardRef-wrapped);
// `shape="circle"` is still a partial gap (rounded square, not a true circle) —
// flag that remaining blocker for design review at this site
```

## Border-override className drift

Core `Button`'s element `outline` is reserved for the **focus ring**; the
color border lives on `::after` (the `borderAfter` helper), and `::before` is
reserved for the primary gradient border. Any `className` from the antd
version that targeted a border, shadow, or ring color on `<Button>` must be
rewritten to target `tw:after:outline-*` (with state variants, e.g.
`tw:after:hover:outline-*`) — `tw:outline-*` on a `Button` silently sets the
*focus* color instead and is a no-op for the visible border. This is the
general Collate rule (no `tw:ring-*`, ever — see repo styling docs, "Overriding
a core component's border from Collate") applied specifically to Button; audit
every `className` carried over during this sweep against it, not just newly
written ones.

## Hand-finish punch list (do not block the bulk codemod run on these)

- **`ghost` boolean + `type="ghost"`** — 38 combined usages (35 boolean + 3
  literal) across R1/R3 — approved mapping `color="tertiary"` (2026-07-30),
  applied per-site by hand (no codemod)
- **`shape="circle"`** — 8 usages (R1 3, R2 5) — partial gap, rounded square only
- **`shape="round"`** — 1 usage (R1) — no pill variant
- **`Button.Group`** — 5 legacy sites (file:line list above) — semantic
  mismatch with core's single-select `ButtonGroup`, redesign per site as a
  flex row of `Button`s
- **`ref`** — 5 live usages — unblocked (ui-core-components `forwardRef`
  landed in main); convert directly, per-site
- **`block`** — 25 usages (R1) — mechanical `tw:w-full` move but every site
  needs visual QA
- **Border-override className drift** — any carried-over `className`
  targeting border/shadow/ring must be re-pointed at `tw:after:outline-*`
- **48 dynamic `size={expr}` sites** — need manual triage independent of
  which literal size mapping is chosen

## Related decisions (recorded 2026-07-30)

- **Tooltip arrow** stays core-default (no arrow) when that sweep comes.
- **Space** maps to `Box` (blessed).
- **Status-colored Tags** migrate to core `Badge`.

## CSS to delete with this sweep

Once a directory's `Button` usages are fully converted, grep for orphaned
`.ant-btn` overrides before deleting:

```bash
grep -rn "\.ant-btn" --include="*.less" --include="*.css" src/
```

Pay particular attention to the `remove-button-default-styling` utility class
(19 R1 usages on `<Button>`) — it exists specifically to strip antd Button
chrome and becomes dead weight once every consumer in a directory has moved
to core `Button` (which has no antd chrome to strip). Confirm with
grep/knip that no remaining call site in that directory still imports antd
`Button` before deleting `.ant-btn` selectors or the utility class itself.

**Sweep-PR checklist line:** after each chunked PR, regenerate the ledger
(`tooling/antd-migration/ledger.mjs`) so the `Button` (and
`antd/lib/button/button-group`) rows in `docs/antd-migration/LEDGER.md`
reflect the reduced antd usage count.

## Styling rules (apply in every PR of this sweep)

- Semantic Tailwind tokens only (`tw:bg-primary`, `tw:text-tertiary`) — never
  raw palette classes or hex.
- No `tw:ring-*` — Button borders are `::after`-based (`tw:after:outline-*`,
  see Border-override section above); never reintroduce a ring class. Full
  rationale: upstream `docs/colors.md` §2.3.1.
- No string literals — use `t('label.…')` / `t('message.…')`, checking both
  `collate-ui/src/main/resources/ui/src/locale/languages/en-us.json` and the
  OpenMetadata submodule's `en-us.json` for an existing key before adding a
  new one.
