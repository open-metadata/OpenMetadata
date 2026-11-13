# A HuggingFace LLM connection defaults to the OpenAI-compatible router at /v1

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Felipe Maciel Cardoso
- **Guard:** reviewer
- **Related:** [OpenMetadata #37035](https://github.com/open-metadata/OpenMetadata/issues/37035), [OpenMetadata #37039](https://github.com/open-metadata/OpenMetadata/pull/37039), [OpenMetadata #36296](https://github.com/open-metadata/OpenMetadata/pull/36296)

## Context

`huggingFaceConnection.json` defaulted `baseURL` to `https://api-inference.huggingface.co`, the
serverless Inference API. HuggingFace retired it, and the domain no longer resolves (checked
2026-11-04). It has two successors on `router.huggingface.co`:

- `/v1`: the OpenAI-compatible router. It serves chat completions only, for every provider's
  models (`GET /v1/models` lists them).
- `/hf-inference`: the HF Inference provider alone, for per-model task calls such as embeddings and
  classification, at `/hf-inference/models/{model}`. Since July 2025 it serves mostly CPU models.

No code in OpenMetadata calls `baseURL` today; LLM services are stored, not connected to. The
default is still the contract a future client builds on.

## Decision

The default is `https://router.huggingface.co/v1`, with the `/v1` segment, because an LLM service
connection targets chat models. A client appends OpenAI paths to it directly (`/chat/completions`,
`/models`), never another `/v1`.

Task models served by HF Inference, and dedicated Inference Endpoints, set `baseURL` explicitly.

## Consequences

Any OpenAI-compatible client works against the default unchanged. A service stored with the old
default keeps it; no migration rewrites it, since nothing calls it yet. If the connection is ever meant to register
task models rather than chat models, this default is the one to revisit.
