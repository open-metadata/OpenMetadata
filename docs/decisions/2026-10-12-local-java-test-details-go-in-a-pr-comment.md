# A local Java test run puts a summary in the PR description and its details in one PR comment

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Mohit Yadav, Sriharsha Chintalapani
- **Guard:** `.github/scripts/test_plan_local_java_tests.py`
  (`test_the_pr_description_gets_a_summary_and_a_comment_gets_the_details`,
  `test_the_details_comment_is_posted_once_then_edited_in_place`,
  `test_steps_a_ci_run_covers_are_not_run_locally`); reviewer for the skills' wording
- **Related:** `.github/scripts/plan_local_java_tests.py`, `.github/java-tests/README.md`,
  open-metadata/OpenMetadata#34818, open-metadata/OpenMetadata#35011

## Context

`make java_affected_run ARGS="--update-pr"` wrote one block into the PR description. It held a
step table, then every class each step ran with its counts, why the plan chose them, the
impacted tests it could not run locally, and the commands. Typical PRs carried 4–6k characters in
it, 35–63% of the description. On #35011 the block took 56,147 of the description's 62,906
characters. Of those, 31,830 were a bug: a step that `--ci-run` covered has no local reports, so
every class in its lane was listed as "selected but produced no report". Reviewers found the
description of the change itself buried, and #35011 was close to GitHub's 65,536-character limit.

## Decision

- The description's block holds the verdict, the commit, the step table, and at most
  `SUMMARY_NAME_LIMIT = 10` names each of failed tests, selected classes without a report and
  classes whose every test was skipped. Impacted tests not run locally and impact-map gaps
  appear only as counts. Ten names are enough to start on a failure; the rest are a click away.
- The details hold the rest: every class each step ran, why the plan chose them, the not-run
  list, the gaps and the commands. They are written to
  `target/java-tests/local-pr-results-details.md`. `--update-pr` posts them as one PR comment
  starting with `<!-- local-java-test-results:details -->` and links that comment from the block.
  A re-run edits the comment. Only a comment by the current `gh` user is edited, so a run by
  someone else posts its own.
- The details name at most `DETAILS_NAME_LIMIT = 100` of each list. GitHub caps a comment at
  65,536 characters too, and a run that fails outright fails every test. Details that still
  exceed the cap are not posted, and the block goes without the link.
- A step a CI run stands in for ran nothing locally, so none of its classes counts as missing.

## Consequences

The description's block stays within a few thousand characters whatever the plan's size. The
per-class record of what ran before review moves to the comment, which the `pr-checklist` skill
now requires instead. Without `gh`, the author pastes the summary and posts the details file as a
comment by hand. openmetadata-collate runs the same planner file, so its copy changes in step.
Revisit if reviewers need a class list without leaving the description.
