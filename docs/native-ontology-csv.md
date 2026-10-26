# Native ontology CSV

The CSV that native ontology import reads and that export writes. One row is one definition. `NativeOntologyCsvCodec` defines the columns once for the reader, the writer, and format detection; `NativeOntologyCsvCodecTest` fails when this page's header line drifts from the codec's.

## Header

The first row must be exactly this, in this order (a byte order mark is tolerated):

```
kind,iri,label,description,conceptType,parents,synonyms,mappings,propertyKind,domain,range,enumValues,unit,identifier,inverse,characteristics,propertyChain,disjointWith,axiomType,property,target,literal,expressions,abstract,definitionSource,deprecated,replacedBy
```

Legacy 23-column headers, subset headers, and reordered headers are rejected. The complete 27-column header is required. Every row states the whole definition, so an empty cell clears that field on an existing definition, as a missing `rdfs:comment` does in RDF. Definitions omitted from the file remain untouched. A subset header would silently wipe fields in the columns it omitted.

## Rows

| `kind` | Required | Optional |
|---|---|---|
| `ONTOLOGY` (at most one) | none | `iri`, `label`, `description` |
| `CONCEPT` | `iri`, `conceptType` | `label`, `description`, `parents`, `synonyms`, `mappings`, `abstract`, `definitionSource`, `deprecated`, `replacedBy` |
| `PROPERTY` | `iri`, `propertyKind` | `label`, `description`, `domain`, `range`, `enumValues`, `unit`, `identifier`, `inverse`, `characteristics`, `propertyChain`, `disjointWith`, `deprecated`, `replacedBy` |
| `AXIOM` | `iri` (the subject), `axiomType` | `property`, `target`, `literal`, `expressions` |

Any other filled cell fails the row. The `ONTOLOGY` row supplies the file's label, which names a new ontology; it never replaces the chosen target.

## Cells

- Enums use their schema names: `OWL_CLASS`, `SKOS_CONCEPT`, `BOTH`; `OBJECT`, `DATA`, `ANNOTATION`; `SUBCLASS_OF`, `EQUIVALENT_CLASS`, `DISJOINT_WITH`, `CLASS_ASSERTION`, `OBJECT_PROPERTY_ASSERTION`, `DATA_PROPERTY_ASSERTION`; `EXACT_MATCH`, `TRANSITIVE`.
- IRIs are absolute. A definition IRI in the RDF, RDFS, OWL, XSD, or SKOS vocabularies is rejected.
- A multi-value cell separates items with `;` and is itself one RFC 4180 record, so an item that contains `;` or `"` is quoted. `propertyChain` and `enumValues` keep their order; other set-like cells are written sorted.
- `parents`: IRIs of named superclasses. Each becomes a `SUBCLASS_OF` axiom with one named-class expression. A repeated item fails the row.
- `mappings`: `TYPE:iri` items, split at the first colon.
- `literal` and `enumValues`: N-Triples literal syntax, for example `"red"` or `"4"^^<http://www.w3.org/2001/XMLSchema#integer>`. `xsd:string` is written bare. Language tags are rejected.
- `identifier`, `abstract`, and `deprecated`: `true` or empty. Empty means false; `false`, numeric values, and other spellings are rejected.
- `definitionSource`: the absolute IRI of the defining document or standard, or empty to clear.
- `replacedBy`: an absolute replacement IRI, or empty to clear. Existing repository validation requires a different definition of the same kind in the same ontology.
- `expressions`: a JSON array of native class expressions. Unknown properties fail. Class axioms need it; a class assertion needs exactly one. Property assertions need `property` plus `target` (object) or `literal` (data). Each `AXIOM` row passes the same shape guard as an authored axiom.

## Strictness and limits

The first problem fails the whole read with `CSV row N, column c: <reason>`, or `CSV row N: <reason>` when no single column is at fault. Row numbers count records with the header as row 1, which is what a spreadsheet shows, so a quoted multi-line cell is one row. A duplicate concept or property IRI, an unknown `kind` or enum, a relative IRI, malformed JSON or literal, a second `ONTOLOGY` row, text after the JSON value in an `expressions` cell, and a property cell its `propertyKind` cannot carry all fail. Only `DATA` properties take `enumValues`, `unit`, and `identifier`. Only `OBJECT` properties take `inverse` and `propertyChain`. `ANNOTATION` properties take no `disjointWith`, and `characteristics` follow the repository's per-kind list.

The input is at most 10 MiB of UTF-8. Each row and each multi-value item counts toward 100,000 statements, and parsing stops after 30 seconds. A CSV accepts at most 1,000 definition rows, including definitions already stored in the target. More than 1,000 changed definitions fails at preview, as for RDF.

## Writing

The writer emits the header, the `ONTOLOGY` row when the document has a header, then concepts, properties, and axioms, with CRLF line endings, UTF-8, and no byte order mark. A `SUBCLASS_OF` axiom with a single named class folds into its subject concept's `parents` once per parent; repeats and every other axiom stay `AXIOM` rows. Writing what was read gives the same bytes.

Left out, as in RDF import: ids, names, FQNs, owners, reviewers, versions, provenance, axiom display names, mapping scheme and source, bindings, and ontology settings.

## Example

```
kind,iri,label,description,conceptType,parents,synonyms,mappings,propertyKind,domain,range,enumValues,unit,identifier,inverse,characteristics,propertyChain,disjointWith,axiomType,property,target,literal,expressions,abstract,definitionSource,deprecated,replacedBy
ONTOLOGY,https://example.org/shop,Shop,Orders and customers,,,,,,,,,,,,,,,,,,,,,,,
CONCEPT,https://example.org/Party,Party,,OWL_CLASS,,,,,,,,,,,,,,,,,,,,,,
CONCEPT,https://example.org/Customer,Customer,Someone who buys,OWL_CLASS,https://example.org/Party,Client,EXACT_MATCH:https://schema.org/Customer,,,,,,,,,,,,,,,,,,,
```
