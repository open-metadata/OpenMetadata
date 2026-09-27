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
 * Value of an RDF 1.2 triple term. Components use the SPARQL Results JSON RDF-term
 * representation recursively.
 */
export interface AgentSparqlTripleTerm {
    object:    RDFTerm;
    predicate: RDFTerm;
    subject:   RDFTerm;
}

/**
 * Value of an RDF 1.2 triple term. Components use the SPARQL Results JSON RDF-term
 * representation recursively.
 */
export interface AgentSparqlTripleTermClass {
    object:    RDFTerm;
    predicate: RDFTerm;
    subject:   RDFTerm;
}

/**
 * An RDF term bound to a result variable using the SPARQL 1.2 Query Results JSON
 * representation. A variable that is unbound in a row is absent from that row.
 */
export interface RDFTerm {
    /**
     * Datatype IRI of a typed literal.
     */
    datatype?: string;
    /**
     * Base direction of an RDF 1.2 directional language-tagged literal.
     */
    "its:dir"?: RDFDirection;
    type:       Type;
    /**
     * Lexical string for an IRI, literal, or blank node; recursive subject-predicate-object
     * value for a triple term.
     */
    value: AgentSparqlTripleTermClass | string;
    /**
     * Language tag of a language-tagged literal.
     */
    "xml:lang"?: string;
}

/**
 * Base direction of an RDF 1.2 directional language-tagged literal.
 */
export enum RDFDirection {
    LTR = "ltr",
    RTL = "rtl",
}

export enum Type {
    Bnode = "bnode",
    Literal = "literal",
    Triple = "triple",
    URI = "uri",
}
