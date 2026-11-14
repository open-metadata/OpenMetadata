# MCP tool schemas leave out the tools.json doc keys

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** @Vishnuujain
- **Guard:** `McpSdkUpgradeTest.toolSchemasLeaveOutOnlyTheDocOnlyKeys`
- **Related:** #37248, #37066

## Context

Each tool's `parameters` in `tools.json` carries a top-level `description` and `examples` next to
the JSON Schema. MCP Java SDK 1.x parsed `inputSchema` into a fixed record and dropped both, so
clients never received them. SDK 2.x keeps `inputSchema` as a plain map and would send them: about
4 KB more on every `tools/list`, and each example object carries a `description` key a model could
copy into a call as if it were an argument.

## Decision

`McpUtils` removes the top-level `description` and `examples` keys from each tool's `parameters`
before building the tool. Every other key, including JSON Schema keywords such as `oneOf` or `$ref`,
is sent as written. A tool without `parameters` gets `{"type": "object"}`.

## Consequences

`tools/list` keeps the size and shape clients saw on SDK 1.x, and the examples stay documentation in
the file. Sending them to models is an open choice in #37248; doing it means taking the key out of
the set in `McpUtils` and updating the Guard test.
