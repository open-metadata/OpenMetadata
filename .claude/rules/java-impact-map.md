---
description: Own new Java code and ITs in the Java impact map, in the same change, before the PR
paths: "**/*.java,openmetadata-spec/src/main/resources/json/schema/**,.github/java-tests/**"
---

# Java impact map

`.github/java-tests/impact-map.json` decides which tests run before a PR (`make java_affected`).
Its areas own code by directory (`sources`) and tests by pattern (`tests`). Whoever adds code
owns it in the map, in the same change, before the PR:

- **New directory** (package, resource or schema folder) under `ownedRoots`: add `"<dir>/**"` to
  the `sources` of the area for that code. A new file in a directory an area already owns
  needs nothing.
- **New IT** that no area's pattern matches: add a package pattern
  (`org/openmetadata/it/tests/foo/**`) or a name pattern (`Foo*IT`) to that area's `tests`.
  Never list a single test.
- **Deleted code or tests** that were the last match of a pattern: remove the pattern.
- Unsure which area? Take the one that owns the code it calls (the hook names it). When none
  fits, add an area with an empty `tests` list.

Hooks enforce it. Writing a file no area owns reports the glob to add and the likely area.
`git push` and `gh pr create` are blocked while the branch leaves the map incomplete; so is a
push from any tool, through the `java-impact-map` pre-push hook (`pre-commit install`). Check
the branch yourself with `python3 .github/scripts/plan_local_java_tests.py --check-branch`.
