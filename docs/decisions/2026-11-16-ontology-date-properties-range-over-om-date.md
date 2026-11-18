# Ontology Date properties range over om:date, defined as xsd:dateTime

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyDateDatatypeTest` and
  `OntologyPropertyResourceIT#dateDataPropertiesRangeOverTheOwl2DateDatatype`
- **Related:** [#37907](https://github.com/open-metadata/OpenMetadata/issues/37907),
  ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule,
  ADR:2026-10-11-glossary-dates-are-xsd-datetime-and-skos-parents-are-not-superclasses

## Context
Ontology Studio offers a Date property type. The obvious range, `xsd:date`, is outside the OWL 2
datatype map, so the property rules and the profile guard reject it. OWL 2 DL also reserves every
`xsd:` IRI, so `xsd:date` cannot be declared as a custom datatype. The only temporal datatypes in
the map are `xsd:dateTime` and `xsd:dateTimeStamp`. The glossary projection made the same call
(ADR:2026-10-11-glossary-dates-are-xsd-datetime-and-skos-parents-are-not-superclasses) with a bare
`xsd:dateTime` range, which loses the fact that the property is a Date.

## Decision
A Date data property's range is `https://open-metadata.org/ontology/date` (`om:date`).
`OwlDatatypeSupport` accepts it as a supported datatype. Every export that declares it also writes
`om:date a rdfs:Datatype ; owl:equivalentClass xsd:dateTime`, and the native importer reads that
definition back as part of the datatype: it never becomes an equivalent-class axiom or a skip.

Values are `xsd:dateTime` literals at midnight, for example `"2026-11-16T00:00:00"^^xsd:dateTime`.
OWL 2 gives a defined datatype no lexical space, so a literal typed `om:date` is rejected. A client
that offers a Date type, such as the Collate Ontology Studio UI, must send `om:date` as the range,
write values at midnight and display only the date part.

`xsd:date` stays rejected as a range.

## Consequences
Reasoners compare and order Date values as dateTimes. A defined datatype supports no facets (OWL 2
§9.4), so a date bound is a facet restriction on `xsd:dateTime`, never on `om:date`. "Date only" is
a convention the client keeps by writing midnight; the server does not reject a non-midnight time.
External ontologies whose ranges are `xsd:date` still have those ranges skipped on import. Revisit
this if OWL adds a date datatype, or if imports must convert `xsd:date` ranges to `om:date`.
