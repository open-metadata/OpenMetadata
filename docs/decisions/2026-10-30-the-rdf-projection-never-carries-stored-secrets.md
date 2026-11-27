# The RDF projection never carries stored secrets

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `RdfPropertyMapperTest.testCredentialFieldsAreNeverEmitted`,
  `JsonLdTranslatorTest.leavesStoredCredentialsOutOfTheDocument`, `RdfOntologyContractTest`,
  `RdfResourceTest` (`entityRdfDiffIsForAdministratorsOnly`, `aUsersRdfIsOnlyForCallersWhoMayReadItsEmail`)
- **Related:** open-metadata/openmetadata-collate#7797

## Context
The JSON-LD contexts mapped a service's `connection`, and an ingestion pipeline's `sourceConfig` and
`openMetadataServerConnection`, to `@json` literals, and fields with no mapping fell back to generic
literals. The stored forms of those fields — encrypted secrets, secret references, a bot's
`authenticationMechanism` — therefore reached the triplestore, the entity JSON-LD and the version
diff. The diff reads stored versions directly, so it also bypassed the redaction each entity's own
versions endpoint applies, and it stays available when RDF storage is off.

## Decision
- `RdfPropertyMapper.CREDENTIAL_PROPERTIES` — `connection`, `sourceConfig`,
  `openMetadataServerConnection`, `authenticationMechanism`, `identityProviderSubject` — are never
  fetched for indexing, emitted as triples, diffed, or written into an entity's JSON-LD.
- The ontology and the JSON-LD contexts do not declare predicates for them.
- `GET /v1/rdf/entity/{type}/{id}/diff` is admin only.
- A user's RDF representation carries its email, so it needs the access that reads the email
  (`authorizePII`).

## Consequences
A new secret-bearing field must join `CREDENTIAL_PROPERTIES`, or the generic fallback writes it.
Triples a deployment already holds for these fields leave the store when the entity is next
re-indexed.
