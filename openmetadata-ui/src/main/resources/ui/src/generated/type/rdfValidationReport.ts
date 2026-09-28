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
 * Bounded, typed SHACL validation result for RDF import and governance APIs.
 */
export interface RDFValidationReport {
    conforms: boolean;
    /**
     * Whether SHACL validation was executed for this operation.
     */
    performed: boolean;
    /**
     * Complete machine-readable SHACL report serialized as Turtle.
     */
    reportTurtle: string;
    /**
     * Whether the typed violation list was capped while reportTurtle remains complete.
     */
    truncated:      boolean;
    violationCount: number;
    violations:     Violation[];
}

export interface Violation {
    focusNode:         string;
    message:           string;
    resultPath?:       string;
    severity:          string;
    sourceConstraint?: string;
    value?:            string;
}
