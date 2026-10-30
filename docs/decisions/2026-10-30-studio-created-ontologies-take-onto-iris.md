# Ontologies created in the Studio take `<baseUri>/onto/<prefix>` IRIs

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `OntologyCreateDialog.test.tsx`, reviewer
- **Related:** open-metadata/OpenMetadata#36713, ADR:2026-10-19-native-ontology-imports-use-working-drafts, ADR:2026-10-14-ontology-definitions-have-independent-entity-storage, ADR:2026-10-19-ontology-studio-opens-native-models-by-default

## Context
An ontology needs an absolute `iri` and `namespace` on create, and every native definition IRI is
minted from that namespace. The Studio's first-run create dialog asks only for a name, an optional
prefix and a description, so the client derives both values. Imports, the RDF projection and other
repositories read the IRIs it writes, so the format has to be fixed and written down.

## Decision
The create dialog in `OntologyCreateDialog.tsx` builds the values with `ontologyIris` and
`derivePrefix` in `OntologyCreateForm.utils.ts`:

- `iri` is `<baseUri>/onto/<prefix>`, where every trailing `/` of `baseUri` is removed first.
  `namespace` is `<iri>#`. With the default base URI and the name `Finance Core`, these are
  `https://open-metadata.org/onto/financec` and `https://open-metadata.org/onto/financec#`.
- `baseUri` is the `baseUri` field of `GET /api/v1/rdf/status`. The server fills it from the
  `rdf.baseUri` setting (`RDF_BASE_URI`), which defaults to `https://open-metadata.org/`. Create
  stays disabled until the status call returns a base URI.
- The default prefix is the name in lower case with every character outside `a`–`z` removed,
  cut to its first 8 characters. Digits, spaces, punctuation and accented letters are dropped.
  When nothing is left, the prefix is `onto`.
- The user can replace the prefix. The dialog trims it and accepts it only when it matches
  `^[A-Za-z0-9_][A-Za-z0-9._-]*$`. It also refuses a namespace that an ontology in its loaded list
  already uses.
- The server does not know this format. It stores `iri` and `namespace` as sent, and only rejects a
  namespace that is not an absolute IRI, with 400. The `onto/` segment, the prefix rules and the
  `#` separator are checked only in the client.

The `onto/` segment keeps user namespaces apart from the OpenMetadata vocabulary under
`https://open-metadata.org/ontology/`. On the default configuration a user prefix such as `ontology`
still mints `https://open-metadata.org/onto/ontology#`, never a namespace inside the vocabulary.

Ontologies created by a library install or by an import into a new ontology do not use this
format. They take the `urn:openmetadata:ontology:<uuid>` identity and the namespace
`urn:openmetadata:ontology:<uuid>:` from ADR:2026-10-19-native-ontology-imports-use-working-drafts.
This record does not change them.

## Consequences
A user who creates an ontology in the Studio gets a readable namespace under the server's own base
URI, and its definitions mint IRIs under it. Changing `rdf.baseUri` affects only ontologies created
afterwards, and does not rewrite stored IRIs. Another client that creates ontologies for people
should use the same shape, so namespaces stay predictable across tools. Because the server does not
enforce the format, an API caller can still send any absolute IRI. Revisit if the server starts
minting ontology IRIs itself, or if the vocabulary moves under `onto/`.
