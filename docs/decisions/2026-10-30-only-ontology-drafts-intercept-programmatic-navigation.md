# Only ontology drafts intercept programmatic navigation

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata UI maintainers through PR #36738 review
- **Guard:** useWorkflowNavigationBlock.integration.test.tsx, OntologyDraftProvider.test.tsx, reviewer
- **Related:** #36737, #36738

## Context

Ontology drafts must survive sidebar navigation as well as links and browser history.
Sidebar buttons live outside the ontology page subtree but share BrowserRouter's
navigator. WorkflowBuilder also uses the navigation guard; its save callback navigates
to View mode before replaying any requested departure. Intercepting that callback
would block a successful save.

## Decision

Only OntologyDraftProvider enables `blockProgrammaticNavigation` to intercept the
shared navigator's `push` and `replace` methods. At most one enabled interceptor may
own a given navigator at a time. Keep the provider at the ontology page boundary;
do not nest active interceptors. Cleanup must restore the original methods before
another owner can install an interceptor.

WorkflowBuilder leaves programmatic interception disabled and relies on link,
browser-history and unload blocking. Its save-then-View transition must remain free
to complete before the original departure is replayed.

The history listener runs in the capture phase. It stops a blocked popstate before
React Router can unmount the dirty editor, restores the source entry, and only then
shows confirmation. Confirmed departures replay the captured destination and state;
acknowledged ontology saves use the scoped completion bypass.

## Consequences

Ontology sidebar navigation cannot silently discard edits, and existing workflow
saves retain their navigation behavior. The shared navigator is mutable state with
a single owner; supporting concurrent interceptors requires a different ownership
design and lifecycle tests before extending this mechanism to another page.
