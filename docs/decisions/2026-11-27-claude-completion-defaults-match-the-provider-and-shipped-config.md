# Claude completion defaults match the provider and the shipped configuration

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** iamkiayun
- **Guard:** `LLMCompletionClientFactoryTest.shippedClaudeModelsMatchSchemaDefaults`
- **Related:** [#36757](https://github.com/open-metadata/OpenMetadata/issues/36757), ADR:2026-10-20-temperature-is-sent-only-to-models-that-accept-it

## Context

A fresh Anthropic configuration requested a retired model on its first call. Bedrock also used that model when the provider block omitted its model ID, although the shipped YAML already selected an EU Haiku inference profile.

## Decision

Use `claude-sonnet-5-5` for direct Anthropic completions, the provider's replacement for Sonnet 3.5. Keep the Bedrock schema default aligned with the existing YAML value, `eu.anthropic.claude-haiku-5-5`. [Anthropic retirement notice](https://platform.claude.com/docs/en/about-claude/model-deprecations) · [AWS inference profile](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html)

## Consequences

An explicit model ID continues to take precedence. Bedrock deployments outside the EU profile's supported regions can select a regional profile through `LLM_BEDROCK_MODEL_ID`. Update the schema and YAML together when a provider retires a default.
