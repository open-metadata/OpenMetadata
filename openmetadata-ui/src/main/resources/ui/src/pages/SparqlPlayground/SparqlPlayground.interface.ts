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

/**
 * The SPARQL console constants/types now live with the reusable
 * {@link ../../components/SparqlQueryConsole/SparqlQueryConsole.component}
 * component, which both this page and Ontology Studio's Query mode render.
 * Re-exported here for backward compatibility.
 */
export {
  DEFAULT_SPARQL_PREFIXES,
  SAMPLE_SPARQL_QUERIES,
  SPARQL_PLAYGROUND_STORAGE_KEY,
} from '../../components/SparqlQueryConsole/SparqlQueryConsole.interface';
export type { SavedSparqlQuery } from '../../components/SparqlQueryConsole/SparqlQueryConsole.interface';
