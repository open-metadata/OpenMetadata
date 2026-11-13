# Upstream ontologies used as import fixtures

Verbatim copies of published ontologies, kept to prove the native RDF importer reads real-world
OWL, RDFS and SKOS files (see `UpstreamOntologyImportTest`). They are test input only and are not
bundled in any pack. Do not edit them; the expected counts depend on the exact bytes.

| File | Source | Version | License |
|---|---|---|---|
| `dcat3.ttl` | https://www.w3.org/ns/dcat3.ttl (W3C DCAT 3) | `owl:versionInfo "3"` | CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ |
| `prov-o.ttl` | https://www.w3.org/ns/prov-o.ttl (W3C PROV-O) | Recommendation 2013-04-30 | W3C Software and Document License, https://www.w3.org/copyright/software-license-2023/ |
| `org.ttl` | https://www.w3.org/ns/org.ttl (W3C Organization ontology) | `owl:versionInfo "0.8"` | W3C Software and Document License; the file also carries a `dct:license` pointing at the Open Data Commons PDDL |
| `time.ttl` | https://www.w3.org/2006/time.ttl (OWL-Time) | 2017-04-06 | CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ |
| `sosa.ttl` | https://www.w3.org/ns/sosa/ (SOSA, fetched with `Accept: text/turtle`) | W3C/OGC Recommendation 2017-10-19 | W3C Software and Document License and OGC Software License, both named in the file |
| `ssn.ttl` | https://www.w3.org/ns/ssn/ (SSN, fetched with `Accept: text/turtle`) | W3C/OGC Recommendation 2017-10-19 | W3C Software and Document License and OGC Software License, both named in the file |
| `odrl.ttl` | https://www.w3.org/ns/odrl/2/ODRL22.ttl (ODRL vocabulary) | 2.2 | W3C document license, https://www.w3.org/Consortium/Legal/2002/ipr-notice-20021231#Copyright/ |
| `skos.rdf` | https://www.w3.org/2009/08/skos-reference/skos.rdf (SKOS) | Recommendation 2009-08-18 | W3C document license |
| `foaf.rdf` | https://xmlns.com/foaf/spec/index.rdf (FOAF) | Paddington Edition, 14 Jan 2014 | CC BY 1.0, http://creativecommons.org/licenses/by/1.0/ |

The larger files used for local checks (FIBO, FHIR R5, schema.org, GS1 Web Vocabulary, Brick) are
not committed.
