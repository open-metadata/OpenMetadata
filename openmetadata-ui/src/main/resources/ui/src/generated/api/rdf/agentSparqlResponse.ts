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
 * Typed SPARQL SELECT result for agent tools, with completeness relative to the submitted
 * query. Results come from the server-configured RDF dataset and default graph, without
 * persona filtering or asset-level authorization.
 */
export interface AgentSparqlResponse {
    head:     Head;
    metadata: Metadata;
    results:  Results;
}

export interface Head {
    /**
     * Projected result variable names, in order.
     */
    vars: string[];
}

export interface Metadata {
    completeness:    Completeness;
    effectiveLimits: EffectiveLimits;
}

export interface Completeness {
    reason?: CompletenessReason;
    /**
     * Completeness is judged against the submitted query, including its own LIMIT and OFFSET.
     */
    relativeTo: RelativeTo;
    status:     CompletenessStatus;
}

export enum CompletenessReason {
    ServerRowLimit = "SERVER_ROW_LIMIT",
}

/**
 * Completeness is judged against the submitted query, including its own LIMIT and OFFSET.
 */
export enum RelativeTo {
    SubmittedQuery = "SUBMITTED_QUERY",
}

/**
 * COMPLETE: every row the submitted query selects is returned. TRUNCATED: the server row
 * limit cut the result. UNKNOWN: completeness could not be established.
 */
export enum CompletenessStatus {
    Complete = "COMPLETE",
    Truncated = "TRUNCATED",
    Unknown = "UNKNOWN",
}

export interface EffectiveLimits {
    /**
     * Top-level LIMIT of the submitted query, when present.
     */
    explicitQueryLimit?: number;
    /**
     * Maximum serialized response size in bytes.
     */
    outputBytesLimit: number;
    /**
     * Rows returned for a query without an explicit top-level LIMIT.
     */
    serverRowLimit: number;
}

export interface Results {
    bindings: { [key: string]: RDFTerm }[];
}

/**
 * An RDF term bound to a result variable. A variable that is unbound in a row is absent
 * from that row.
 */
export interface RDFTerm {
    /**
     * Datatype IRI of a typed literal.
     */
    datatype?: string;
    type:      Type;
    value:     string;
    /**
     * Language tag of a language-tagged literal.
     */
    "xml:lang"?: string;
}

export enum Type {
    Bnode = "bnode",
    Literal = "literal",
    URI = "uri",
}
