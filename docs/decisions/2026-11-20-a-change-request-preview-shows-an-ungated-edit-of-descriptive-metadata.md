# A change-request preview shows an ungated edit of descriptive metadata

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Felipe Maciel Cardoso
- **Guard:** `ApprovalGatePreviewOpsTest`, `ChangeRequestServiceTest` (`publishedEditRequiresNoApprovalAndStillReportsItsOps`,
  `anUngatedEditToAnythingButDescriptiveMetadataGetsNoOps`, `heldEditDoesNotComputeItsOpsTwice`, `anUngatedPreviewReturnsOpsOnlyForDescriptiveFields`),
  `ChangeRequestResourceIT` (`anUngatedDescriptionEditIsPreviewedWithItsOpsAndNothingIsSaved`,
  `anUngatedDescriptionIsPreviewedAsThePatchSavesIt`,
  `ungatedTagOwnerAndColumnEditsArePreviewedAsThePatchSavesThem`,
  `anUngatedPreviewIsRefusedToACallerWhoCannotMakeTheEdit`,
  `aDescriptionPreviewDoesNotReportATagTheTableInherits`,
  `anUngatedEditBeyondDescriptiveMetadataIsPreviewedWithoutOps`)
- **Related:** open-metadata/ai-platform#1870,
  ADR:ai-platform/2026-11-20-a-chat-write-is-applied-from-the-diff-the-user-approved

## Context

`POST /v1/changeRequests/preview/{entityType}/{id}` returned ops only when an approval workflow
would hold the edit. Collate's AI chat needs to show a user the exact change a PATCH makes before
sending it, gated or not, and the change-request diff already draws those ops.

## Decision

1. A preview returns the ops of an edit no workflow holds, planned by `MutationPlanner` from the
   same prepared entity a gated preview uses. A changed description is cleaned first, as saving it
   cleans it, so the preview shows the text the PATCH saves. DERIVED tag labels, inherited or
   implied by a glossary term, are left out on both sides, as saving ignores them. Nothing is
   stored.
2. It does so only when every patched field is in `ChangeRequestService.DESCRIPTIVE_FIELDS`: the
   metadata a person reviews as a diff (description, display name, tags, owners, domains, data
   products, columns, certification, glossary synonyms, related terms and parent, and the metric
   fields). An ungated edit that touches any other field gets no ops, as before, and so does one
   whose preparation changes a field outside that set: the ops of an ungated preview are only ever
   on descriptive fields. A glossary term that is not Approved is previewed as an add; the save
   holds it as pending until the term is approved (#38239).
3. A gated edit takes its ops from its staged change only; they are never planned twice.
   `requiresApproval` and `workflowDefinitionId` keep their meaning.

## Consequences

- A client reads "no ops" as "this edit cannot be shown", never as "no change".
- Adding a field to `DESCRIPTIVE_FIELDS` widens what every preview caller receives, so it is a
  change to this record.
- An ungated preview prepares the patched entity a second time after the gate check, the cost of
  keeping the gated path unchanged.
