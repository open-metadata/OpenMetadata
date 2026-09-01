# Glossary indexing regression fix

## Goal

Restore the 1.13 glossary-rename search-indexing behavior so the existing
`GlossaryResourceIT.test_renameGlossaryPropagatesToChildTermSearchIndex`
integration test passes in CI.

## Scope

Revert only the `GlossaryRepository.updateAssetIndexes` backport introduced in
commit `3a674af59a`. Keep the existing integration test and all unrelated test
stability fixes unchanged.

## Design

The backport synchronously re-read and indexed glossary terms before the
rename transaction had committed. Those reads can observe stale glossary
denormalized values, which CI demonstrated in every integration profile.

Restore the prior 1.13 implementation, which schedules the established
reindexing operations rather than performing the new synchronous child-term
reads in the transaction. This matches the behavior on which PR #32100 passed
the rename-propagation integration test.

Do not port the post-commit deferral primitives from `main`: they are not
available in 1.13 and would expand the backport beyond the CI regression fix.

## Verification

1. Run the targeted `GlossaryResourceIT` rename-propagation test where the
   integration environment is available.
2. Run the integration-test module compilation check.
3. Confirm the patch changes only `GlossaryRepository` (plus this design
   record) and passes `git diff --check`.
