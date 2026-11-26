# Playwright is upgraded by hand, with every pin moved in one change

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** OpenMetadata UI maintainers
- **Guard:** `.github/dependabot.yml` ignore rule for `@playwright/test` and `playwright*`;
  `scripts/patch-playwright-indexeddb.cjs` throws on any version other than `PATCHED_VERSION`
- **Related:** #37380, #38454, open-metadata/openmetadata-collate#8909

## Context
The Playwright version is not only the `@playwright/test` entry in
`openmetadata-ui/src/main/resources/ui/package.json`. It is also pinned in:

- the `mcr.microsoft.com/playwright:v<version>-jammy` image tags in `.github/workflows/`;
- the `npx playwright@<version> install` steps of the nightly workflows;
- `PATCHED_VERSION` in `scripts/patch-playwright-indexeddb.cjs`, which corrects the IndexedDB
  restore in the installed `playwright-core` and must be revalidated on every upgrade;
- Collate's `package.json` files and workflows, which build against this repository.

Dependabot (#38454) bumped `@playwright/test` from 1.57.0 to 1.65.1 alone. `main` then ran a
1.65.1 test runner against 1.57 browsers, and the IndexedDB patch no longer matched the package.

## Decision
Dependabot ignores `@playwright/test` and `playwright*` for the UI. A Playwright upgrade is one
hand-made change that moves the package, the image tags, the browser installs and
`PATCHED_VERSION` together, after revalidating the IndexedDB correction, with the matching
Collate change opened alongside it.

## Consequences
Playwright no longer gets automatic patch or security bumps; someone has to schedule upgrades.
In exchange no partial bump can land. Revisit if the version is read from one place (for example
the image tag derived from `package.json`) and the IndexedDB patch is no longer needed.
