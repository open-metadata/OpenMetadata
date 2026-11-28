# MCP ontology proposals reuse the authorized REST actions

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial); v2 2026-11-18 (bounded proposal reads and write acknowledgements)
- **Deciders:** Contributor implementation for #33459
- **Guard:** `OntologyToolDiscoveryTest`, `OntologyToolContractTest`, `OntologyToolExecutionTest`,
  `OntologyProposalSchemaTest`, `OntologyChangeSetPagingTest`, `CollectionRegistryTest`,
  `McpOntologyGovernanceIT`
- **Related:** #33459; ADR:2026-11-17-mcp-discovers-relationship-types-through-existing-read-tools;
  ADR:2026-11-13-an-mcp-write-an-approval-workflow-holds-answers-pending-approval

## Context

The relationship catalog is already discoverable through explicit `relationshipType` search
and named detail reads. Typed relation creation and the ontology proposal lifecycle have additional
REST authorization and concurrency checks. Generic repository access cannot substitute for those
checks: change-set reads require access to the draft's scope, creation checks the affected scope
and normal entity limits, and submission requires a current caller-owned edit lease.

## Decision

- `create_term_relation` takes source and target glossary-term IDs and a governed relationship-type
  name. It requires view permission on both terms before calling the canonical source-edit action.
  It stamps `AiSuggested` provenance, accepts no caller-supplied lifecycle status or attribution,
  and leaves default status, validation, inverse handling, deduplication and approval staging to
  the normal repository. `AiSuggested` is origin metadata, not evidence of correctness or approval.
- `create_ontology_change_set` decodes the canonical typed create request, including typed
  operations and their evidence fields. The MCP surface accepts neither state/cursor overrides
  nor ownership/provider/source-pack changes. The canonical mapper stamps the caller, starts a
  `DRAFT`, and the normal resource enforces scope, create permissions and limits. Operations are
  retained for review; they are not applied by creation.
- Existing-target operations retain the canonical optimistic concurrency requirement. A metadata
  `get_entity_details(includeVersion=true)` read returns the authorized entity's current version
  for `baseVersion`; default detail responses continue to omit it. The canonical operation
  validator rejects an existing-target proposal without its version. No version is guessed or
  silently refreshed during submission.
- `describe_entity_type(entityType=ontologyChangeSet)` returns public canonical operation schemas
  without reading an entity or enabling generic creation. Its optional `schema` selector fetches
  a specific proposal or payload shape and the complete classpath reference closure. Loading is
  restricted to nine named roots, bounded to 128 distinct schemas and never fetches external URLs.
  This keeps detailed payload shapes out of every initial tool list while making the documented
  workflow executable. The proposal selector describes the canonical REST request; the dedicated
  MCP create tool accepts only its advertised subset. The normal response budget still applies.
- `get_ontology_change_set` authorizes one non-deleted proposal through the canonical draft-scope
  and entity-view checks on every page. It returns compact identity/lifecycle metadata and whole
  items from `section=operations` (default), `section=applicationResults`, or compact glossary
  scope identifiers from `section=glossaries`. Native ontology identifiers remain in the metadata;
  scope references include IDs, types and names without their free-form descriptions. `limit` defaults to
  10 and must be 1–25; the shared response budget can reduce the actual count. The result carries
  section totals, counts and `hasMore`/`nextCursor`. Application counters remain visible without
  resending its whole result list. Descriptions, display names and verbose change diffs are omitted
  so metadata cannot duplicate the unpaged timeline. Generic `get_entity_details` still refuses
  change sets, including batch/content reads, and directs callers to this tool.
- Continuations are opaque keyset tokens containing a SHA-256 proposal/section snapshot and next
  offset. Invalid, foreign or stale cursors are rejected with restart guidance, including content
  changes that retain the same entity version. Cursors convey no authorization: the canonical
  resource checks the caller before cursor content is inspected. The stored DTO is not modified.
  These pages bound the MCP wire payload; the canonical resource still loads the stored proposal.
- Paging preserves each returned operation/result in full. As with the shared response-budget
  contract, a single item that cannot fit with required metadata under `maxResponseChars` cannot be split into whole-item pages and
  remains an explicit oversized response requiring the REST API. No rationale or payload is
  silently cut and no response limit or permission is relaxed.
- Create and submit return compact acknowledgements with identity, lifecycle, item counts and the
  canonical write outcome, including pending-change IDs for approval holds. They do not echo the
  operation timeline or application results: large successful writes must retain the ID needed
  for paged reads instead of becoming a data-less response-budget notice. Normal validation,
  status handling and change-event publication run before this projection.
- `ontology_change_set_lease` explicitly acquires, renews or releases a lease. It requires a
  readable draft and uses the normal edit-lock resource's edit authorization. Renewing requires
  the current version; no foreign lease is stolen or implicitly replaced. Submission takes the
  exact caller-owned session/version token. The canonical lease service enforces holder, expiry,
  session and version. Generic `patch_entity` refuses change sets rather than skipping that path.
- `submit_ontology_change_set` first requires a readable draft, then invokes the canonical scope-
  and lease-checked transition. Its result is `SUBMITTED`, not approval, application or release
  publication. Application, undo/redo and discard remain in the existing UI/API workflow.
- MCP reuses the initialized resource instances from a typed, fail-closed collection-registry
  lookup. It does not construct resources per call or register permission mappings again. Direct
  invocation uses the actual caller security context and a URI context built from the configured
  public base URL and API root. The decoded generated requests receive recursive Bean Validation;
  invalid requests are transport-level 400 errors, not server faults.
- Successful writes publish the existing MCP entity change event because direct invocation does
  not pass through the REST response filter. Actual 201 creation responses can omit the change
  header; other writes must carry it. Approval holds retain the pending-change ID and
  `pendingApproval` outcome, without an update event or a claim that a relation was persisted.
  No-change responses report `unchanged`.
- All five tools operate without RDF. Read-only and disabled-tool controls continue to use the
  ordinary MCP registration path and tool annotations. No administrator shortcut is added.

## Consequences

An agent can discover a valid relation type, contribute a typed AI-suggested edge, or create,
read and submit a typed proposal without applying it. Lease management is explicit and recoverable
through the existing API. Generic tools cannot offer a shorter change-set read/write path that
omits the special scope and lease checks.

Submission currently records review intent as a durable state. The existing submit resource does
not automatically create a reviewer task, and the default workflow consumer does not process
`ontologyChangeSet`. Existing workflow handling can also skip bot update events. These tools do
not promise automatic reviewer routing, human approval, model compliance, or that an AI suggestion
is true. Review and publication must continue through the configured normal OpenMetadata process.

The in-process adapter preserves the canonical authorized actions rather than duplicating their
private scope logic. It does not reproduce every HTTP response-filter effect, such as websocket
notifications. Unit tests with resource/authorizer doubles establish transport and response
contracts; actual authentication, authorization, persistence and lease integration require the
dedicated MCP integration test against a running supported stack.
