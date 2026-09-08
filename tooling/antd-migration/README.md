# antd-migration ledger

Counts remaining antd usage per component per repo, plus `.ant-*` selector
counts. The generated `LEDGER.md` lives in the Collate repo at
`docs/antd-migration/LEDGER.md` (it covers private repos too).

Regenerate (from the Collate repo root, where all repos are reachable):

    node OpenMetadata/tooling/antd-migration/ledger.mjs \
      --repo openmetadata-ui=OpenMetadata/openmetadata-ui/src/main/resources/ui \
      --repo collate-ui=collate-ui/src/main/resources/ui \
      --repo collate-local-webserver=collate-local-webserver/ui \
      --out docs/antd-migration/LEDGER.md

Every sweep PR regenerates the ledger. A component's sweep is done when its
row reads zero in every column.
