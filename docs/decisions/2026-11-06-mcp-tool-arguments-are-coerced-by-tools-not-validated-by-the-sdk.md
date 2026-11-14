# MCP tool arguments are coerced by each tool, not validated by the SDK

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** @Vishnuujain
- **Guard:** `McpSdkUpgradeTest.looseArgumentsStillReachTheTool`
- **Related:** #37248, ADR:2026-11-06-mcp-tool-schemas-leave-out-the-tools-json-doc-keys

## Context

MCP Java SDK 2.x validates `tools/call` arguments against each tool's `inputSchema` by default and
answers a mismatch with an `isError` result before the tool runs. Our tools accept looser shapes on
purpose, because LLMs and some MCP clients stringify arguments: `search_metadata` parses `size`,
`from` and `maxAggregationBuckets` from a number or a string, booleans from `true` or `"true"`, and
`queryFilter` from a string or an object (`McpToolsValidationIT` sends an object). With validation
on, every one of those calls would fail.

## Decision

`McpServer.buildServer` sets `validateToolInputs(false)`. Each tool parses and checks its own
arguments and answers bad input with its own error.

## Consequences

Clients that send loose shapes keep working, and a tool's error names the bad argument in its own
words. The schemas in `tools/list` describe the preferred shape, not everything a tool accepts.
Turning validation on would need either the schemas widened to what each tool accepts or the lenient
parsing removed, and a check against real clients either way.
