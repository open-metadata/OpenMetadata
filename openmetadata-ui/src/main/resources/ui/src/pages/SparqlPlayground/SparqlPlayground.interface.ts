/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  SparqlPlaygroundFormat,
  SparqlPlaygroundInference,
} from '../../rest/rdfAPI';

export interface SavedSparqlQuery {
  id: string;
  name: string;
  query: string;
  format: SparqlPlaygroundFormat;
  inference: SparqlPlaygroundInference;
  savedAt: number;
}

export const SPARQL_PLAYGROUND_STORAGE_KEY =
  'om.sparql-playground.savedQueries';

export const DEFAULT_SPARQL_PREFIXES = [
  'PREFIX om: <https://open-metadata.org/ontology/>',
  'PREFIX dcat: <http://www.w3.org/ns/dcat#>',
  'PREFIX dct: <http://purl.org/dc/terms/>',
  'PREFIX prov: <http://www.w3.org/ns/prov#>',
  'PREFIX skos: <http://www.w3.org/2004/02/skos/core#>',
  'PREFIX foaf: <http://xmlns.com/foaf/0.1/>',
  'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
  'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
  'PREFIX dqv: <http://www.w3.org/ns/dqv#>',
].join('\n');

/**
 * Sample queries displayed in the SPARQL Playground sidebar.
 *
 * The visible label is an i18n key (resolved by the component via {@code t(nameKey)}); the
 * `query` body is intentionally not translated — SPARQL is a structured language and translating
 * a query template would corrupt its semantics. Add a new sample by appending an entry here and
 * adding the matching `label.sparql-sample-*` key to en-us.json (then `yarn i18n` to sync).
 */
export const SAMPLE_SPARQL_QUERIES: ReadonlyArray<{
  nameKey: string;
  query: string;
}> = [
  {
    nameKey: 'label.sparql-sample-tables-tagged-pii',
    query: `${DEFAULT_SPARQL_PREFIXES}

SELECT ?table ?tableFqn ?tagFqn WHERE {
  ?table a om:Table ;
         om:fullyQualifiedName ?tableFqn ;
         om:hasTag ?tag .
  ?tag om:tagFQN ?tagFqn .
  FILTER(STRSTARTS(?tagFqn, "PII."))
} LIMIT 50`,
  },
  {
    nameKey: 'label.sparql-sample-fk-references',
    query: `${DEFAULT_SPARQL_PREFIXES}

SELECT ?fromCol ?fromFqn ?toCol ?toFqn WHERE {
  ?fromCol om:references ?toCol ;
           om:fullyQualifiedName ?fromFqn .
  ?toCol om:fullyQualifiedName ?toFqn .
} LIMIT 50`,
  },
  {
    nameKey: 'label.sparql-sample-upstream-lineage',
    query: `${DEFAULT_SPARQL_PREFIXES}

SELECT ?upstream ?upstreamFqn WHERE {
  ?downstream om:fullyQualifiedName "service.db.schema.target_table" .
  ?downstream prov:wasDerivedFrom+ ?upstream .
  ?upstream om:fullyQualifiedName ?upstreamFqn .
} LIMIT 100`,
  },
  {
    nameKey: 'label.sparql-sample-low-completeness',
    query: `${DEFAULT_SPARQL_PREFIXES}

SELECT ?table ?fqn ?metric ?value WHERE {
  ?table a om:Table ;
         om:fullyQualifiedName ?fqn ;
         om:hasColumn ?column .
  ?column dqv:hasQualityMeasurement ?m .
  ?m dqv:isMeasurementOf ?metric ;
     dqv:value ?value .
  FILTER(?metric = om:NullProportionMetric && ?value > 0.05)
} LIMIT 50`,
  },
];
