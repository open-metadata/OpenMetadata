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
 * A SPARQL CONSTRUCT rule that materializes derived triples in the OpenMetadata knowledge
 * graph (e.g. transitive lineage, PII propagation, tag inheritance).
 */
export interface InferenceRule {
    /**
     * What the rule does and why it is enabled. Markdown.
     */
    description?: string;
    /**
     * Human-readable name.
     */
    displayName?: string;
    /**
     * Whether the rule is currently active. Disabled rules are loaded but not applied.
     */
    enabled?: boolean;
    /**
     * Stable identifier for the rule (used as primary key). Lowercase letters, digits, hyphen.
     */
    name: string;
    /**
     * Execution order hint. Lower numbers run first. Rules at the same priority run in name
     * order.
     */
    priority?: number;
    /**
     * The rule body. For ruleType=CONSTRUCT, a SPARQL CONSTRUCT query that emits the inferred
     * triples.
     */
    ruleBody: string;
    /**
     * Body language. CONSTRUCT is a SPARQL CONSTRUCT query that produces new triples. RDFS is a
     * placeholder for future Jena-RDFS rule format.
     */
    ruleType?: RuleType;
    /**
     * Free-form labels (e.g. 'lineage', 'security', 'governance') for filtering in admin UI.
     */
    tags?: string[];
}

/**
 * Body language. CONSTRUCT is a SPARQL CONSTRUCT query that produces new triples. RDFS is a
 * placeholder for future Jena-RDFS rule format.
 */
export enum RuleType {
    Construct = "CONSTRUCT",
    Rdfs = "RDFS",
}
