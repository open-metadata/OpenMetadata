# Native class authoring rebuilds its plan only after a definite refusal

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OntologyNewClassPanel.test.tsx`, `useOntologyChangeSetApply.test.tsx`, `OntologyNativeChangeSet.utils.test.ts`
- **Related:** ADR:2026-10-16-native-ontologies-share-studio-and-memory-review; ADR:2026-10-19-native-ontology-imports-use-working-drafts; PR #36721

## Context

The New class panel writes one class, with its properties and axioms, as one native change set. `useOntologyChangeSetApply` freezes a plan after its first submission so that a retry cannot write it twice, which is the rule the library installation follows. A class form is different: when the server refuses the plan with a 4xx, such as 412, the user needs to fix the form or try again against the current revision, and a frozen plan would keep failing.

## Decision

Each Create class press builds a plan with `buildNewClassChangeSet`, named `class-<uuid v4>`, against the working revision that `getOntologyState` returns at that moment. Every id and axiom name the plan generates is a UUID v5 of `<attempt name>:<key>` in the URL namespace, so the same attempt always carries the same identities.

`isRefusedByServer` treats only an HTTP response with status 400–499 as a definite refusal. When `apply` fails, the outcome is unknown if the apply request was sent, the response was not a 4xx, and a re-read of the change set does not settle it. A re-read or name lookup that fails, on apply or on Retry, also leaves the outcome unknown. A failed create is settled when the name lookup confirms that no change set exists, and it is unknown when the lookup fails. Other failures before the apply request, such as a contended lease or a missing permission, are refusals.

The hook's `rebuildAfterFailure` option decides what a refusal does. With the option, `planState` lets `start` replace the plan after a refusal, and it holds the frozen plan only while busy or while the outcome is unknown. Without the option, the default, the plan stays frozen until it is applied or unchanged. Only `OntologyNewClassPanel` sets the option. `useNativeOntologyInstall` and `OntologyNativeLibraryDetail` keep the default.

After a refusal, the panel shows the error and unlocks the form and Close, and Create class builds a new attempt from a fresh working revision. After an unknown outcome, the panel keeps the form locked and replaces Create class with Retry, which re-reads the same change set by id, or looks it up by name when the id is not known. If the lookup confirms that no change set has that name, Retry creates it again under the same name. Retry then applies that change set, unless it is already applied.

## Consequences

After a refusal, nothing was applied, so a new plan is safe and uses the current working revision. A refusal at the apply stage, such as a contended lease, comes after the create, so the refused attempt's change set stays behind unapplied, in DRAFT or APPLY_FAILED, and the rebuild creates a second change set under a new name. After an unknown outcome, the apply may have committed, so a new plan with a new name could create the class twice. Re-reading the frozen change set either finds it applied or applies it once. A caller that wants rebuilds must opt in, and it must build its plan with fresh identities for each attempt. If the server ever returns a 4xx after committing, this rule would rebuild a written plan and has to change.
