# AntD → @openmetadata/ui-core-components migration

Program design: see the Collate repo, `docs/superpowers/specs/2026-07-27-antd-untitled-migration-design.md`.

## The sweep playbook (per antd component)

1. **Gap check** — grep the *actually used* prop surface across openmetadata-ui,
   collate-ui and collate-local-webserver/ui; compare against the
   `ui-core-components` equivalent. Missing capability is added to
   `openmetadata-ui-core-components` first, in its own PR, with unit tests.
2. **Mapping guide** — copy `TEMPLATE.md` to `<component>.md` in this folder and
   fill it in. The guide is the review contract for every PR of that sweep.
3. **Codemod** (mechanical components only) — see `tooling/antd-codemods/`.
4. **Chunked PRs** — ~20–40 files per PR, chunked by directory. Each PR also
   deletes the dead code it orphans (grep/knip-proven only) and regenerates
   visual baselines for intentionally changed pages.
5. **Ledger update** — regenerate the ledger (see `tooling/antd-migration/`).

## Rules encoded in every guide

- Semantic Tailwind tokens only (`tw:bg-primary`), never raw palette or hex.
- No `tw:ring-*` — borders use `border`/`outline` (see upstream `docs/colors.md` §2.3.1).
- No string literals — `t('label.…')`, checking existing keys in both locale files first.
- QueryBuilder files are owned by PR #29849 — do not touch.

## Visual-regression harness: the load-bearing check

Per-PR human design review is off for this program. Wave 1 primitives accumulate on
`antd-migration/wave-1`; the Playwright visual-regression suite
(`openmetadata-ui/.../playwright/e2e/VisualRegression/*.spec.ts`) is what gates every
change instead, and a before/after contact sheet of the accumulated baselines is the
single design review at the end. That only works if the suite actually stays green for
the *right* reason — determinism, not tolerance — so it must cover the composition
contexts where styling coupling actually bites (a `Typography` inside a `Form` picks up
the `Form`'s styles; the same primitive inside a `Table` or a `Modal` doesn't). See
OM#30783 for the repair that established this convention.

**Masking convention** (also documented inline in `staticPages.spec.ts`):

- Mask the smallest **existing** testid that covers the volatile region first. Prefer a
  container over per-cell selectors when the volatility is layout-shifting rather than
  just text (e.g. an auto-width table column whose width depends on seeded content —
  masking one cell still lets every other cell in the row slide, and the diff fails
  anyway). In that case mask the whole table/container testid.
- Add a **new** `data-testid` only when no existing selector reaches the volatile
  node. Keep it small and semantic, consistent with sibling testids already in the same
  component (e.g. `team-name-${record.name}` next to `team-asset-count`) — don't invent
  a new naming scheme for one call site.
- A page whose baseline can never be stable because it's captured mid-async-load (a
  skeleton, an empty widget) is a **wait bug, not a masking bug** — find the real
  loaded-state signal (a skeleton testid detaching, a count element appearing) and wait
  for it before the screenshot. Don't paper over it with a wider
  `maxDiffPixelRatio`; that hides real regressions along with the flake.
- **Intentional visual changes regenerate baselines in the same PR** that makes the
  change, using the Docker command below — never a follow-up PR, and never by hand on
  macOS (font/subpixel rendering differs from CI's Linux runners and will produce a
  baseline that immediately fails in CI).
- Before merging a harness change, run the suite twice in a row in Docker and confirm
  zero diffs both times. A single green run doesn't prove determinism — it proves the
  run got lucky once.

**Baselines MUST be generated from a CI run's artifacts, never from a local dev server.**
The Docker regen command below runs against whatever database the local dev server
(`localhost:8585`) happens to have — a long-lived instance accumulates a dataset that
drifts from CI's freshly-seeded environment (different row counts, different seed
values, different ordering for anything not sorted by a stable key). Two consecutive
*local* runs only prove **run-to-run stability against that one local dataset** — they
say nothing about whether the baseline will match the dataset CI seeds fresh on every
run. A baseline built locally can pass its own PR and then fail on every subsequent PR
once CI reseeds, which is exactly the failure mode this rule exists to prevent (see the
`roles` / `applications` / `incident-manager` repair in OM#30798, where three baselines
generated from a long-lived local server failed in CI purely on content/order, not
styling).

Adoption procedure when a baseline needs to be (re)generated:

1. Get the actuals from the failing (or latest) CI run: download the
   `visual-regression-diffs` artifact (`gh run download <run-id> -n
   visual-regression-diffs -D /tmp/<dest>`), which contains
   `output/test-results/<test-dir>[-retry1]/<page>-actual.png` for every attempt.
2. **Verify the page is deterministic within CI** before adopting anything: `cmp` the
   non-retry `<page>-actual.png` against the retry1 one for the same run. Byte-identical
   (or a pixel-diff showing only single-channel anti-aliasing noise on a handful of
   pixels, e.g. via Pillow's `ImageChops.difference`) means the page's content/order is
   stable within CI and the run-to-run difference is only local-vs-CI drift — safe to
   adopt. If the two CI attempts disagree on real content (different rows, different
   order beyond noise), the page is non-deterministic even within CI and must **not** be
   adopted as-is — instead scope the screenshot with `clip` (or screenshot a locator for
   only the deterministic chrome) to exclude the volatile region, rather than masking or
   widening tolerances.
3. Copy the chosen actual (prefer the retry1 directory when present — it's the
   assertion CI's own retry logic accepted) over
   `playwright/e2e/VisualRegression/__snapshots__/<spec>.spec.ts-snapshots/<page>.png`.
4. `Read` the adopted PNG before committing — confirm it shows a real, fully-loaded page
   (not a skeleton, an error state, or a blank canvas masked over).
5. The local Docker command below is still the right tool for **verifying** a baseline
   change (confirming determinism, checking a masking fix), but the artifact that
   actually ships as the committed baseline must come from CI, not from that command's
   output.

Regenerate baselines for Linux rendering parity (macOS-rendered PNGs will not match CI):

```bash
PW_VERSION=$(node -p "require('./package.json').devDependencies['@playwright/test'] || require('./package.json').dependencies['@playwright/test']")
docker run --rm -e PLAYWRIGHT_TEST_BASE_URL=http://host.docker.internal:8585 \
  -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v${PW_VERSION}-jammy \
  yarn playwright:visual:update
```
