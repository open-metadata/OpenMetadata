# The German UI calls a data asset "Daten-Asset" and an asset "Asset"

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial) · v2 2026-11-26 (ingestion is "Erfassung") · v3 2026-11-26 (domain is "Domäne")
- **Deciders:** Sascha Halm (proposal), the reviewers of the linked PR
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#38630, open-metadata/OpenMetadata#37334, open-metadata/OpenMetadata#37335, open-metadata/OpenMetadata#38843, open-metadata/OpenMetadata#38869

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

## Amendment — 2026-11-26: ingestion is "Erfassung"

Second term from the glossary in #38630, tracked in #38843. `de-de.json` mixed "Ingestion", "Aufnahme",
"Datenaufnahme", "Datenübernahme" and "Verwendungsaufnahme" for the English "ingestion", next to
"Erfassung", which the navigation label `label.ingestion` already used.

- English "ingestion" is "Erfassung", feminine: "die Erfassung". New compounds follow the forms
  already in the file: closed for established words ("Erfassungspipeline", "Erfassungsworkflow",
  "Nutzungserfassung"), hyphenated with a product or English term ("dbt-Erfassung",
  "Erfassungs-Scheduler"). Existing forms such as "Metadaten-Erfassung" stay unchanged.
- The verb "ingest" in the service page sub-headers is rendered with the noun as well:
  "Erfassung von Metadaten aus …".
- Exception: `message.field-ca-certs-description` keeps "Ingestion-Container", because it names the
  technical component (the ingestion container), not the activity.

## Amendment — 2026-11-26: domain is "Domäne"

Third term from the glossary in #38630, tracked in #38869. Most `de-de` strings already said
"Domäne", but the label keys behind the navigation and the domain pages said "Bereich", and others
said "Domain", "Datenbereich", "Datendomain" or "Geschäftsbereich". "Bereich" also renders "range"
and "scope" elsewhere in the file, so it is ambiguous.

- English "domain" (the catalog entity) is "Domäne", feminine: "die Domäne", plural "Domänen".
  Compounds are closed: "Domänentyp", "Domänenebene", "Datendomäne". "Sub domain" is "Subdomäne".
- Not affected: "domain" in other senses keeps its own word — the domain of an ontology property
  (`label.property-domain`), an internet domain (`message.marketplace-verify-msg`, "Domain") and a
  subject area in general prose (glossary help texts, "business domain" → "Geschäftsbereich").
