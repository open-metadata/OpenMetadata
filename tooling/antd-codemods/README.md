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

## Tests

    yarn test
