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

import type { SavedSparqlQuery } from '../../rest/rdfAPI';

export const BUNDLED_GLOSSARY_QUERY_TEMPLATES: SavedSparqlQuery[] = [
  {
    id: '692cb99a-96fd-4f47-8f28-3d7e471ff001',
    name: 'All glossary terms',
    query: `PREFIX om: <https://open-metadata.org/ontology/>

SELECT ?conceptFqn WHERE {
  GRAPH <https://open-metadata.org/graph/knowledge> {
    ?concept a om:GlossaryTerm ;
             om:fullyQualifiedName ?conceptFqn .
  }
}
ORDER BY ?conceptFqn
LIMIT 100`,
    format: 'json',
    inference: 'none',
    savedAt: 0,
  },
  {
    id: '692cb99a-96fd-4f47-8f28-3d7e471ff002',
    name: 'Glossary term relationships',
    query: `PREFIX om: <https://open-metadata.org/ontology/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?sourceFqn ?relationship ?targetFqn WHERE {
  GRAPH <https://open-metadata.org/graph/knowledge> {
    ?source a om:GlossaryTerm ;
            om:fullyQualifiedName ?sourceFqn ;
            ?relationship ?target .
    ?target a om:GlossaryTerm ;
            om:fullyQualifiedName ?targetFqn .
    VALUES ?relationship {
      om:relatedTo om:antonym om:partOf om:hasPart
      om:calculatedFrom om:usedToCalculate skos:broader skos:narrower
      skos:exactMatch
    }
  }
}
ORDER BY ?sourceFqn ?relationship ?targetFqn
LIMIT 100`,
    format: 'json',
    inference: 'none',
    savedAt: 0,
  },
  {
    id: '692cb99a-96fd-4f47-8f28-3d7e471ff003',
    name: 'Isolated glossary terms',
    query: `PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?conceptFqn WHERE {
  GRAPH <https://open-metadata.org/graph/knowledge> {
    ?concept a om:GlossaryTerm ;
             om:fullyQualifiedName ?conceptFqn .
    FILTER NOT EXISTS {
      ?concept ?outgoing ?target .
      ?target a om:GlossaryTerm .
      FILTER(?outgoing != rdf:type)
    }
    FILTER NOT EXISTS {
      ?source ?incoming ?concept .
      ?source a om:GlossaryTerm .
      FILTER(?incoming != rdf:type)
    }
  }
}
ORDER BY ?conceptFqn
LIMIT 100`,
    format: 'json',
    inference: 'none',
    savedAt: 0,
  },
];
