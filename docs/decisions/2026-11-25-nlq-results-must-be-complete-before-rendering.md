# NLQ results must be complete before rendering

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** Search maintainers
- **Guard:** searchAPI.test.ts

## Decision

The shared NLQ REST adapter rejects HTTP 200 responses that report `timed_out`,
`partial_results`, or a positive `_shards.failed` count. Existing Explore and Marketplace error
handling surfaces the failure, instead of rendering surviving hits or an empty hydration page as
a complete catalog result. No extra request or automatic retry is introduced.

The fields remain optional for compatibility with older complete responses. Ordinary empty
successful searches still return normally. This does not change keyword-only search behavior.
