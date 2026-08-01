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

Regenerate baselines for Linux rendering parity (macOS-rendered PNGs will not match CI):

```bash
PW_VERSION=$(node -p "require('./package.json').devDependencies['@playwright/test'] || require('./package.json').dependencies['@playwright/test']")
docker run --rm -e PLAYWRIGHT_TEST_BASE_URL=http://host.docker.internal:8585 \
  -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v${PW_VERSION}-jammy \
  yarn playwright:visual:update
```
