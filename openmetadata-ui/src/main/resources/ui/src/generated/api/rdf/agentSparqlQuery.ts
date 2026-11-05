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
 * Permissioned read-only SPARQL SELECT request for agent tools. The server selects the
 * dataset, inference policy, and protective limits; only the query text is
 * caller-controlled.
 */
export interface AgentSparqlQuery {
    /**
     * SPARQL SELECT query. Explicit LIMIT and OFFSET are honored within server maxima. FROM,
     * FROM NAMED, GRAPH, and SERVICE are rejected.
     */
    query: string;
}
