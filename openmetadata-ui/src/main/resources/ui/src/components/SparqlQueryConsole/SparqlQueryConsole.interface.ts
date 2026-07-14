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

export interface SparqlQueryConsoleProps {
  className?: string;
  initialQuery?: string;
}

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
