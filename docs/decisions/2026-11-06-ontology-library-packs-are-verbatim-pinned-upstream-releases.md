# Ontology library packs are verbatim pinned upstream releases

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `python3 scripts/ontology-packs/generate.py --check` (`make ontology-packs-check`, also a `make harness-check` warning), OntologyPackCatalogTest, OntologyPackVerifierTest, BundledOntologyPackImportTest, NativeOntologyEveryPackInstallIT
- **Related:** ADR:2026-10-19-native-ontology-imports-use-working-drafts

## Context

The library packs were four- to ten-concept SKOS sketches written by us, under IRIs we invented (`https://open-metadata.org/library/...`), and named FIBO, FHIR and GS1. A user who installed "FIBO" got concepts that no FIBO document, mapping or SPARQL query recognises. Importing a real standard is now possible because the native importer keeps what it can hold and reports the rest (ADR:2026-10-19-native-ontology-imports-use-working-drafts), so the sketches no longer earn their place where an open, permissively licensed ontology exists.

## Decision

A bundled pack is an upstream release, byte for byte, at a pinned URL, with the publisher's IRIs. `scripts/ontology-packs/sources.json` holds one entry per pack (publisher, version, pinned URL, `downloadSha256`, license and license URL, attribution text, industry, layer, modules). `scripts/ontology-packs/generate.py`, which needs only the Python standard library, is the only writer of the payloads under `openmetadata-spec/src/main/resources/rdf/ontology-packs/`, the manifests and `index.json` under `openmetadata-service/src/main/resources/json/data/ontology/packs/`, the payload README, and the generated block of `NOTICE`. It downloads a payload only when the checked-in file does not already match its pinned hash, so a second run changes nothing, and `--check` verifies everything offline. It never converts a format: Turtle stays Turtle and RDF/XML stays RDF/XML, because the importer reads both. A publisher that changes a pinned file fails the run until a maintainer reviews it and re-pins.

A pack ships only when its license permits redistribution inside an Apache-2.0 distribution with attribution. The generator rejects any license that is not in `allowedLicenses` of the source list: CC BY 4.0 and 1.0, CC0, MIT, BSD-3-Clause, Apache-2.0, the W3C Software and Document and Document licenses, and the Open Data Commons PDDL. A pack names its attribution in the manifest, the Library detail shows it, and `NOTICE` carries it.

These are not bundled, and the source list records the reason for each: schema.org (CC BY-SA 3.0 share-alike needs counsel), the GS1 EPCIS and CBV ontologies (no license grant), DCMI Terms (license unconfirmed), SAREF (the ETSI license text could not be read), QUDT (not evaluated; its header carries a UCUM notice), ISA-95 (a paid standard) and HR Open (no RDF form). Reversing an exclusion needs a new record.

ISA-95, HR Open and EPCIS keep an OpenMetadata-authored starter, renamed `<Standard> Starter (OpenMetadata-authored)`, licensed Apache-2.0 as part of OpenMetadata, and described as aligned to the standard. A starter never claims to be a subset or a copy of it.

A manifest counts a module's `conceptCount` as the distinct IRIs typed `owl:Class`, `rdfs:Class` or `skos:Concept` in its file, and `relationshipCount` as the distinct IRI-to-IRI `rdfs:subClassOf`, `rdfs:subPropertyOf` and `skos:broader`, `narrower` and `related` statements. They describe the file, so a module that re-declares terms of its dependency counts them again.

Every pack installs through the library install job, whatever its size: there is no per-pack install mode. The preview, review and sample of a pack read its modules through the trusted parser, against their catalogue checksums, and are not held to the 1,000 changed definitions that one interactive native import accepts. The review lists at most 5,000 items. Every pack fits the 50,000-member ontology limit. `BundledOntologyPackImportTest` previews each pack, and `NativeOntologyEveryPackInstallIT` installs each one into a fresh ontology.

The catalogue reads `json/data/ontology/packs/index.json`, which the generator writes, instead of a hard-coded list. A missing index, a missing or malformed manifest, or a manifest whose `id` differs from its file name stops the server at startup.

## Consequences

Adding a pack is one entry in the source list and a run of `make ontology-packs`. An update to a pack is a reviewed re-pin, not an edit of a payload. The jar carries about 18 MB of uncompressed RDF, which the build compresses. A mapping or query written against FIBO, DCAT or PROV-O IRIs works against an installed pack. A user who installed an old starter FIBO keeps its concepts, but its recorded version no longer matches the catalogue, so a later install of the same pack id replaces the record. The import preview of a small pack now reports the statements it skipped, which is most of an upstream OWL file.

Revisit when the licenses of an excluded vocabulary are confirmed, or when a third party needs a pack to be split into modules by the publisher.
