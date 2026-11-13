# The Playwright server stores uploads in memory

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `ContextCenterDocument.spec.ts` › "a document uploaded while extraction is off…" (a
  text upload must reach Processed and read Not processed)
- **Related:** open-metadata/OpenMetadata#37479

## Context

`conf/openmetadata.yaml` leaves object storage off (`ASSET_UPLOADER_ENABLE` defaults to `false`),
so the server uses `NoOpAssetService`. Its `upload` succeeds and its `read` returns `null`, so text
extraction marks every Context Center upload `Failed` with "Unable to read file content from
object storage". No upload can reach `Processed`, so a spec cannot cover the Not processed state,
its Extract action, or anything else that needs a file's content on the server.

`start_playwright_fast_environment.sh` launches the server for every Playwright shard and set no
object storage variables.

## Decision

The Playwright server runs with `ASSET_UPLOADER_ENABLE=true` and `ASSET_UPLOADER_PROVIDER=inmemory`,
exported by `start_playwright_fast_environment.sh`. Uploads are kept in the server's heap and are
lost when the server stops.

## Consequences

- Uploads behave as in production: text extraction reads the bytes, so a `.txt` upload reaches
  `Processed`, and only content that cannot be parsed (a non-PDF named `.pdf`) fails.
- A spec that needs a failed document must upload content that fails to parse. Relying on storage
  being off no longer works.
- Uploaded bytes add to the server heap for the shard's lifetime. Specs upload small files, so this
  is negligible at 1 GB. Revisit, or switch to a MinIO container, if a spec uploads large files.
- The h2 lane (`conf/openmetadata-h2-test.yaml`) hardcodes storage off and is unaffected.
