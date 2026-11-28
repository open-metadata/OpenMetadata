# OpenAI max_completion_tokens is chosen by model id

- **Status:** Accepted
- **Revisions:** v1 2026-11-28 (initial)
- **Deciders:** Search / AI platform team
- **Guard:** `LLMCompletionClientTest.usesMaxCompletionTokensFollowsModelId`, `OpenAICompletionClientTest`
- **Related:** #36739, ADR:2026-10-20-temperature-is-sent-only-to-models-that-accept-it

## Context
`OpenAICompletionClient` sent `max_tokens` in every chat-completion request body. OpenAI's
o-series reasoning models (`o1`, `o3`, `o4-mini`) and `gpt-5+` models reject `max_tokens` with
HTTP 400 (`Unsupported parameter: 'max_tokens' is not supported with this model. Use
'max_completion_tokens' instead`). Older OpenAI and OpenAI-compatible models still expect
`max_tokens`, and no capability endpoint advertises which parameter a configured model id accepts.

## Decision
`LLMCompletionClient.usesMaxCompletionTokens(modelId)` decides whether `OpenAICompletionClient`
sends `max_completion_tokens` instead of `max_tokens`, sharing the same matching rule as
`supportsTemperature(modelId)`: entries containing a hyphen match as lower-cased substrings
(`gpt-5`, `gpt-6`), and bare entries match a whole non-alphanumeric-delimited segment (`o1`, `o3`,
`o4`), so ids that embed those tokens inside a larger segment (`o10`, `pro3-chat`, `gpt-4o1`) are
never matched. A null model id keeps `max_tokens`.

## Consequences
Requests to OpenAI and Azure OpenAI o-series and `gpt-5+` models send `max_completion_tokens`
instead of `max_tokens` without changing schema or configuration fields, while legacy OpenAI and
OpenAI-compatible endpoints keep receiving `max_tokens`. Temperature suppression remains governed
separately by ADR:2026-10-20-temperature-is-sent-only-to-models-that-accept-it. Future OpenAI model
families that require `max_completion_tokens` must be added to `MAX_COMPLETION_TOKENS_MODELS`, and
an Azure deployment whose `modelId` hides the underlying model name must set `modelId` to a string
containing the model family name.
