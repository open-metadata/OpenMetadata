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
