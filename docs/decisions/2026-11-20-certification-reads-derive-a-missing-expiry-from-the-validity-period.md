# A certification read derives a missing expiry from the validity period

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `CertificationWithoutExpiryIT`;
  `EntityRepositoryCertificationTest#getCertificationDerivesMissingExpiryFromConfiguredValidityPeriod`,
  `#getCertificationWithoutAppliedAtReadsAsAppliedAtEpoch`,
  `#fetchAndSetFieldsWithTagsOnlyReplacesStaleInlineCertification`,
  `#fetchAndSetFieldsWithoutTagsOrCertificationClearsInlineCertification`;
  `BundleWarmupCertificationBackfillTest#cachedCertificationWithoutExpiryIsRebuiltAndReCached`
- **Related:** #38002, #32793, #35026

## Context

Certification is read from any tag_usage row under the configured classification, and not every
row carries metadata.expiryDate. Tags on create, dbt data-model tags, the 2.0.x Tags-page asset
picker, a classification switch and the 1.12.5 migration of JSON that had no expiry leave it out,
and typed clients reject the entity. Separately, raw entity-row writes left a stale
inline certification that bulk reads served.

## Decision

`expiryDate` and `appliedDate` stay required. Every certification the server returns carries both:
a missing expiry reads as appliedDate + the current validityPeriod (UTC, the stamping arithmetic);
a missing appliedAt reads as the epoch. Bulk reads load certification whenever tags or certification
is requested (as single reads do) and never serve a copy from the entity row.

## Consequences

Clients need no change. The read writes nothing to tag_usage, but copies taken from reads — version
snapshots, change events, search and RDF documents, Redis bundles — keep the value derived at that
moment. A legacy row's expiry therefore follows later validityPeriod edits while those copies do
not, and derivation (SettingsCache, 3-minute TTL) can briefly disagree with stamping (DB) after an
edit. Revisit — stamp on every tag write path plus a backfill — if expiry starts driving server
behaviour.
