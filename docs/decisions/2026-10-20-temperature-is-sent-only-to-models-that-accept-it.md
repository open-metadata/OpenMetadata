# Temperature is sent only to models that accept it, decided by model id

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Search / AI platform team
- **Guard:** `LLMCompletionClientTest.supportsTemperatureFollowsModelId` and the per-client
  request tests in `openmetadata-service/src/test/java/org/openmetadata/service/llm/`
- **Related:** #35808 (completion clients send temperature to models that reject it)

## Context
The completion clients in `org.openmetadata.service.llm` always sent `temperature` (0.0 by
default). Newer models reject the field and fail the whole call. Bedrock's `converse` on
`eu.anthropic.claude-haiku-5-5` returns `ValidationException ... temperature is deprecated for
this model`, while `eu.anthropic.claude-haiku-4-5-20251001-v1:0` accepts it. No provider API
says ahead of time whether a model takes sampling params. CAIP (ai-platform) already decides
this by model id in `BaseBuilder.SAMPLING_PARAM_REJECTORS`.

## Decision
`LLMCompletionClient.supportsTemperature(modelId)` is the only place that decides this. The
Bedrock, Anthropic and OpenAI clients leave `temperature` out of a request whenever it returns
false. The rejector list is copied from CAIP: `opus-4-7`, `opus-4-8`, `opus-5`, `sonnet-5`,
`haiku-5`, `fable-5`, `mythos-5`, `o1`, `o3`, `o4-mini`, `gpt-5.6`, `gpt-6`. Entries that
contain a hyphen match as substrings of the lower-cased id, so `sonnet-5` matches `sonnet-5-5`
but not `sonnet-4-5`. Entries without a hyphen must equal a whole id segment (split on
non-alphanumerics), so `o1` and `o3` never match `gpt-4o-mini`. A null model id keeps
temperature. The Bedrock default in `conf/openmetadata.yaml` is `eu.anthropic.claude-haiku-5-5`.

## Consequences
Switching to a rejecting model no longer needs a config change, and a configured `temperature`
is silently ignored for those models. Every new model family that rejects sampling params has to
be added to the list here and in CAIP, or its first call fails. The check only sees the model
id, so it misses ids that don't name the model. One example is a Bedrock application inference
profile ARN (`arn:aws:bedrock:…:application-inference-profile/<id>`) wrapping Haiku 5.5. Another
is an Azure OpenAI deployment whose `modelId` doesn't say `o3`. Both still get `temperature` and
fail. The workaround is to configure an id that names the model: the foundation model or a
system inference profile on Bedrock, the underlying model name as `modelId` on Azure. Revisit this if the providers
expose model capabilities, or if a model starts rejecting `top_p` or another param these clients
send.
