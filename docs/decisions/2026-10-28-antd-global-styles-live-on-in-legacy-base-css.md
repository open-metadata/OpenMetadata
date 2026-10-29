# antd's global styles live on in legacy-base.css after the antd package is removed

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Harshit Shah
- **Guard:** reviewer
- **Related:** open-metadata/openmetadata-collate#7504, ADR:2026-10-11-antd-imports-are-frozen-by-eslint-suppressions

## Context
No source file imports antd any more, but `antd-master.less` still compiled
`antd/dist/antd.variable.less` into every page. Besides styles for components nothing renders, that
emitted antd's element reset (`body` font and colour, `h1`–`h6` and `p` margins, `a` colour, form
control inheritance), the `--ant-*` custom properties `variables.less` reads, and rules for three
class names the app still renders. Dropping the package outright would move text and spacing
across the whole app.

## Decision
- The `antd` dependency, its Vite aliases and the `vendor-antd` chunk are removed. The ESLint
  ratchet in ADR:2026-10-11-antd-imports-are-frozen-by-eslint-suppressions is deleted with it:
  with the package gone an antd import no longer resolves, so the build is the guard.
- `src/styles/legacy-base.css` holds every rule antd 4.24.16 emitted that does not target an
  `ant-*` component, compiled with our `variables.less` so the values are the ones that shipped,
  plus the antd rules for the two `ant-*` classes `FieldErrorTemplate` and `Loader` still rendered,
  renamed with them to `form-field-error` and `loader-content`. It loads where `antd-master.less` did, ahead of
  `master.less` (the renamed `antd-master.less`, minus the antd import).
- No `ant-*` name survives: the `--ant-*` colour properties become `--theme-*` (the runtime theme
  in `useThemeCssVariables` writes them), `--ant-navbar-height` becomes `--navbar-height`, and the
  remaining `ant-*` class names are renamed or dropped. `tw-guard` and `tw-audit` stop checking
  for antd imports.
- `rc-virtual-list`, which `SelectableList` used through antd, is a direct dependency at the
  version antd resolved.
- The file is a vendored snapshot: `token-audit` exempts it. Rules are deleted as their consumers
  move to core components, never restyled in place.

## Consequences
The compiled global CSS is rule-for-rule identical to what `antd-master.less` produced minus the
`ant-*` component rules, so removing the package changes no visual. The cost is a ~360-line
snapshot with hardcoded values outside the token system. Revisit it when the element reset is
replaced by Tailwind preflight plus core typography; that is a visual change and needs its own
review.
