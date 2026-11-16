# Ontology Date properties range over om:date, defined as xsd:dateTime

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyDateDatatypeTest` and
  `OntologyPropertyResourceIT#dateDataPropertiesRangeOverTheOwl2DateDatatype`
- **Related:** ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule

## Context
Ontology Studio offers a Date property type. The obvious range, `xsd:date`, is outside the OWL 2
datatype map, so the property rules and the profile guard reject it. OWL 2 DL also reserves every
`xsd:` IRI, so `xsd:date` cannot be declared as a custom datatype. The only temporal datatypes in
the map are `xsd:dateTime` and `xsd:dateTimeStamp`.

## Decision
A Date data property's range is `https://open-metadata.org/ontology/date` (`om:date`).
`OwlDatatypeSupport` accepts it as a supported datatype. Every export that declares it also writes
`om:date a rdfs:Datatype ; owl:equivalentClass xsd:dateTime`, and the native importer reads that
definition back without reporting a skip.

Values are `xsd:dateTime` literals at midnight, for example `"2026-11-16T00:00:00"^^xsd:dateTime`.
OWL 2 gives a defined datatype no lexical space, so a literal typed `om:date` is rejected. Clients
such as the Ontology Studio UI send `om:date` as the range and display only the date part.

`xsd:date` stays rejected as a range.

## Consequences
Reasoners compare and order Date values as dateTimes, and facets such as `xsd:minInclusive`
work on them. "Date only" is a convention the client keeps by writing midnight; the server does
not reject a non-midnight time. External ontologies whose ranges are `xsd:date` still have those
ranges skipped on import. Revisit this if OWL adds a date datatype, or if imports must convert
`xsd:date` ranges to `om:date`.
