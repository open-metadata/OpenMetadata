# The German UI calls a data asset "Daten-Asset" and an asset "Asset"

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Sascha Halm (proposal), the reviewers of the linked PR
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#38630, open-metadata/OpenMetadata#37334, open-metadata/OpenMetadata#37335

## Context
`de-de.json` rendered the English "data asset" with seven different words: "Daten-Asset",
"Datenasset", "Datenvermögenswert", "Datenobjekt", "Datenressource", "Datenbestand" and
"Datenanlage". The plain "asset" was
mostly "Asset", but 15 keys said "Vermögenswert", which in German is a balance-sheet term
(a financial asset), not a catalog entry.

## Decision
- English "data asset" is "Daten-Asset" (plural "Daten-Assets"), neuter: "das Daten-Asset".
  Compounds hyphenate through: "Daten-Asset-Regel", "Daten-Asset-Seiten".
- English "asset" on its own is "Asset" (plural "Assets"), neuter.
- "Datenbestand" stays reserved for "data estate" (`label.browse-estate`,
  `message.your-data-estate`).
- "Vermögenswert", "Datenobjekt", "Datenressource" and "Datenanlage" are not used for either term.

## Consequences
- A new or changed `de-de` string with "data asset" or "asset" uses these words; a reviewer
  rejects the other variants.
- Other core terms (Ingestion, Domain, Service, Owner, …) are proposed in the linked
  glossary issue and are added to this record as amendments when their PRs land.
- Revisit only if the English product term changes.
