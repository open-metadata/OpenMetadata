# Ontologies created in the Studio take `<baseUri>/onto/<prefix>` IRIs

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial) · v2 2026-11-03 (the prefix keeps digits and is numbered when taken, the ID comes from the display name, Advanced replaces the IRI and namespace, installs and imports take the same IRIs) · v3 2026-11-14 (accented letters fold to their base letter instead of being dropped)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `OntologyCreateDialog.test.tsx`, `OntologyCreateForm.utils.test.ts`, `useOntologyIdentitySource.test.tsx`, `OntologyNativeStudio.spec.ts` ("keeps Create enabled for names that differ only in digits"), `OntologyStudioFlows.spec.ts` (flow 2), reviewer
- **Related:** open-metadata/OpenMetadata#36713, ADR:2026-10-19-native-ontology-imports-use-working-drafts, ADR:2026-10-14-ontology-definitions-have-independent-entity-storage, ADR:2026-10-19-ontology-studio-opens-native-models-by-default

## Context
An ontology needs an absolute `iri` and `namespace` on create, and every native definition IRI is
minted from that namespace. The Studio's first-run create dialog asks only for a name, an optional
prefix and a description, so the client derives both values. Nothing else in the repository reads
the `onto/` shape, and the server does not check it, so the format is fixed and written down for
the clients that create ontologies.

## Decision
The create dialog in `OntologyCreateDialog.tsx` builds the values with `ontologyIris` and
`derivePrefix` in `OntologyCreateForm.utils.ts`:

- `iri` is `<baseUri>/onto/<prefix>`, where every trailing `/` of `baseUri` is removed first.
  `namespace` is `<iri>#`. With the default base URI and the name `Finance Core`, these are
  `https://open-metadata.org/onto/financec` and `https://open-metadata.org/onto/financec#`.
- `baseUri` is the `baseUri` field of `GET /api/v1/rdf/status`. The server fills it from the
  `rdf.baseUri` setting (`RDF_BASE_URI`), which defaults to `https://open-metadata.org/`. Create
  stays disabled until the status call returns a base URI.
- The default prefix is the name with accents folded to their base letter (`Ü` reads `U`), in lower
  case with every character outside `a`–`z` removed, cut to its first 8 characters. Digits, spaces,
  punctuation and letters with no base Latin letter are dropped.
  When nothing is left, the prefix is `onto`.
- The user can replace the prefix. The dialog trims it and accepts it only when it matches
  `^[A-Za-z0-9_][A-Za-z0-9._-]*$`. It also refuses a namespace that an ontology in its loaded list
  already uses.
- The server does not know this format. `iri` and `namespace` are `type/ontologyIri.json`, mapped
  to `java.net.URI`, so each must parse as a URI. The repository then rejects a relative `iri` (the
  inherited `prepare` calls `requireAbsoluteIri`) and a relative `namespace` (`validateDefinition`),
  each with 400. The `onto/` segment, the prefix rules and the `#` separator are checked only in
  the client.
- The server does not refuse a duplicate `namespace` either. The `ontology_entity` table is unique
  only on `fqnHash`. Its `iriHash` is the MD5 of `$.iri` behind a non-unique index, no column or
  index covers `namespace`, and `OntologyLayerValidator` compares only the prefixes inside one
  ontology. The duplicate refusal above is therefore client-only, and an API caller can create two
  ontologies with the same namespace.

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

## Amendment

v2 2026-11-03. This amendment replaces three parts of the Decision above: the default prefix rule,
the prefix that the user can replace, and the paragraph on library installs and imports. The
`<baseUri>/onto/<prefix>` shape, the source of `baseUri`, the client-only duplicate refusal and the
facts about what the server checks are unchanged.

The v1 rule dropped digits, so `VF Guard 37973` and `VF Guard 41022` both gave the prefix
`vfguard`. The second name's namespace was then taken, and **Create** stayed disabled with no
message. The same change moved the dialog to one display name field, with the ID, IRI and
namespace generated from it, and a message for each refusal before submit. The create dialog now
works as follows.

- The default prefix is the display name in lower case with every character outside `a`–`z` and
  `0`–`9` removed, cut to its first 8 characters, or `onto` when nothing is left. While an ontology
  in the dialog's loaded list already uses the namespace that a prefix gives, `derivePrefix`
  appends `2`, then `3`, and so on. `VF Guard 1` and `VF Guard 2` give `vfguard1` and `vfguard2`.
  `VF Guard 37973` gives `vfguard3`, and `VF Guard 38000` then gives `vfguard32`. `Finance Core`
  still gives `financec`.
- The ontology `name`, its immutable ID, defaults to `deriveOntologyId(displayName)`. That is the
  display name with accents folded, in lower case, with each run of characters outside `a`–`z` and
  `0`–`9` replaced by `-` and leading and trailing `-` removed. `Finance Core` gives
  `finance-core` and `Café & Bar` gives `cafe-bar`; dropping the accented letter outright gave
  `caf-bar` and turned `Ümlauts` into `mlauts`. An existing ontology keeps its ID.
- The dialog refuses a display name or ID that contains `::`, `"`, `>` or a control character, that
  is longer than 256 characters, or that equals the name or display name of a loaded ontology,
  ignoring case.
- A collapsed **Advanced** section shows the ID, the IRI, the namespace and the layer. The user can
  replace the ID, the IRI and the namespace. A replaced IRI or namespace must be an absolute IRI
  (`isAbsoluteOntologyIri`) and need not follow the `onto/` shape. A replaced IRI makes the
  namespace `<iri>#` unless the user replaces the namespace as well. The prefix is no longer an
  input, so `^[A-Za-z0-9_][A-Za-z0-9._-]*$` no longer checks anything the user types.

Library installs and imports into a new ontology now name the ontology the same way, through
`generatedOntologyIdentity` and `useOntologyIdentitySource`. The title is the pack name for an
install. For an import it is the file's ontology label, or the file name without its extension
when the file has no label. A display name that is already taken gets
` (2)`, ` (3)` and so on. The ontology list these paths read includes soft-deleted ontologies,
because a soft-deleted ontology still holds its name. They fall back to the
`urn:openmetadata:ontology:<uuid>` identity of ADR:2026-10-19-native-ontology-imports-use-working-drafts
only when the RDF base URI or the ontology list is unavailable, or when no free name is found in 999
attempts.

In `OntologyNativeStudio.spec.ts`, "keeps Create enabled for names that differ only in digits"
creates `Qzx Guard 37973 <suffix>` and `Qzx Guard 38000 <suffix>` through the dialog, and checks
that their IRIs and namespaces differ. `OntologyStudioFlows.spec.ts` flow 2 creates a name that
differs from a taken one only in digits.
