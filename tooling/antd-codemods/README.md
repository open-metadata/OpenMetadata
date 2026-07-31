# antd-codemods

jscodeshift transforms for the antd → ui-core-components migration.
Guides live in `docs/antd-migration/`; each guide names its transform.

## Run a transform

    cd tooling/antd-codemods && yarn install
    npx jscodeshift -t transforms/move-named-imports.js \
      ../../openmetadata-ui/src/main/resources/ui/src/components/SomeArea \
      --parser=tsx --names=Divider --from=antd --to=@openmetadata/ui-core-components

The same transforms run against collate-ui and collate-local-webserver/ui by
pointing the path argument at those repos' `src` folders.

Files a transform cannot fully convert are left untouched; collect them per
sweep with the ledger (`tooling/antd-migration/`) and hand-finish.

## `antd-typography-to-core`

Converts antd `Typography` sub-components (`Text`/`Title`/`Paragraph`/`Link`,
including destructured usages) to the flat core `Typography` component. See
`docs/antd-migration/typography.md` for the full mapping table.

    npx jscodeshift -t transforms/antd-typography-to-core.js \
      <path-to-src> --parser=tsx

Only touches files that import `Typography` from `'antd'`. Elements it can't
mechanically convert (`copyable`, `ellipsis.expandable`, dynamic
`level`/`strong`/`underline`/`type` expressions, bare `<Typography>`, …) are
left untouched and reported via `console.warn`; partially-converted files get
a `CoreTypography`-aliased import alongside the surviving antd one. The
`Typography.Title` `level` → `size` convention (`LEVEL_SIZE_MAP` in the
transform) was approved 2026-07-30.

## Tests

    yarn test
