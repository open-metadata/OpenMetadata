/*
 *  Copyright 2025 Collate.
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
 * SPARQL query response
 */
export interface SparqlResponse {
    /**
     * Boolean result for ASK queries
     */
    boolean?: boolean;
    /**
     * Header information about the query results
     */
    head?: Head;
    /**
     * Query results
     */
    results?: Results;
}

/**
 * Header information about the query results
 */
export interface Head {
    /**
     * Links to additional resources
     */
    link?: string[];
    /**
     * List of variable names in the results
     */
    vars?: string[];
    [property: string]: any;
}

/**
 * Query results
 */
export interface Results {
    /**
     * Result bindings
     */
    bindings?: { [key: string]: Binding }[];
    [property: string]: any;
}

export interface Binding {
    datatype?:   string;
    type:        Type;
    value:       string;
    "xml:lang"?: string;
    [property: string]: any;
}

export enum Type {
    Bnode = "bnode",
    Literal = "literal",
    URI = "uri",
}
