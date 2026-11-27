# MCP article passages must match the current page's chunks

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** OpenMetadata MCP and Search maintainers
- **Guard:** `PageBodyTextContributorTest` checks stored chunk matching and compatibility.
  `GetEntityToolTest` and `AIContextBuilderTest` check content and context fallback using hits
  built by `VectorDocBuilder`.
- **Related:** #38450, #38489, #38883,
  ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service

## Context

Stored `textToLLMContext` wraps each article chunk in catalog metadata and a chunk footer. An
image-only hit could still contain this framing after image removal, so MCP returned metadata
instead of the article's text. Stored chunks can also lag behind edits to the page.

## Decision

- `VectorDocBuilder` writes the metadata, the ` | ` separator, the chunk text, and the trailing
  ` | chunk N/M` footer. `N` is the one-based ordinal. The footer can contain localized decimal
  digits.
- `PageBodyTextContributor` uses the same article text and `TextChunkManager` boundaries as the
  writer. It locates the current chunk by `N` and checks that the full chunk text and its leading
  separator match immediately before the footer. Matching the suffix allows pipes within the
  metadata and article. `M` records the indexed total, so an unchanged chunk remains readable
  after an edit appends more chunks.
- Remove image spans while preserving those boundaries. Keep hits whose cleaned article
  description contains readable text and render them with their header and footer. If the search
  yields no readable hits, `get_entity_details(include=["content"])` returns the cleaned full
  article. It returns empty content when that article consists entirely of images removed by the
  cleaner.
- `AIContextBuilder` cleans linked articles before applying the knowledge budget and skips
  opening blocks left empty by image removal. For a query-relevant excerpt it requests up to
  three ranked hits in one lookup and excerpts the first readable article body without its index
  framing. With no readable hit it uses the structural preview of the cleaned article within the
  same budget.

## Consequences

The reader works with documents already stored in this format. It spends local CPU and memory
re-chunking an article when search returns hits.
Changes to the framing or chunk boundaries need coordinated updates to the writer, reader, and
regression tests, with a rollout that accounts for existing indexed documents.
