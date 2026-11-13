# Document processing reads assets through their repository

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextFileProcessingServiceTest#defaultProcessingReadsTheRepositorysAssetStore`

## Context

A distribution can mirror chat uploads into Context Center while retaining the existing asset.
Its chat store and the OSS document store can have different object keys or separate in-memory
instances. Reading the asset through the document store then fails even though chat reads it.

## Decision

`ContextFileProcessingService` obtains bytes through `ContextFileRepository.readAsset(Asset)`.
The default hook uses the OSS asset service. A distribution can override the repository to select
the store that received an asset. Every default processing-service instance uses the hook, including
manual extraction, retry, and startup recovery.
The repository registers under the explicit name `ContextFileRepository`, so distribution overrides
with a lower priority replace it deterministically.

## Consequences

A mirrored file needs no second upload or persisted provider flag. Storage selection stays with the
distribution, while text extraction, memory extraction, job recovery, and stats remain shared.
