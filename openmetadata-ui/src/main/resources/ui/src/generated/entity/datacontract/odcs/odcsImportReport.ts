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
 * What importing an ODCS document into OpenMetadata keeps, changes and leaves out, so the
 * user can decide whether to import it.
 */
export interface OdcsImportReport {
    /**
     * Whether the requesting user may create test cases on the target, which importing quality
     * rules as test cases requires.
     */
    canCreateTestCases?: boolean;
    /**
     * False when at least one issue is blocking.
     */
    canImport?: boolean;
    issues?:    OdcsImportIssue[];
    /**
     * `apiVersion` the document declares.
     */
    odcsVersion?:  string;
    qualityRules?: OdcsQualityRuleOutcome[];
}

/**
 * One finding about the ODCS document. Findings about the same key in many places, e.g.
 * `businessName` on every property, are reported once with the number of occurrences.
 */
export interface OdcsImportIssue {
    category: OdcsImportIssueCategory;
    /**
     * ODCS key the finding is about, e.g. `businessName`.
     */
    field?: string;
    /**
     * What happens to the field and why.
     */
    message: string;
    /**
     * Number of places in the document the finding applies to.
     */
    occurrences?: number;
    /**
     * Location of the first occurrence in the document, e.g.
     * `schema[0].properties[3].businessName`.
     */
    path?:    string;
    severity: OdcsImportIssueSeverity;
}

/**
 * Part of the ODCS document an issue is about.
 */
export enum OdcsImportIssueCategory {
    Document = "document",
    Other = "other",
    Quality = "quality",
    Roles = "roles",
    Schema = "schema",
    Servers = "servers",
    Sla = "sla",
    Support = "support",
    Team = "team",
}

/**
 * `blocking` issues prevent the import; `warning` issues mean part of the document will not
 * be imported, or not as written; `info` issues describe how something is imported.
 */
export enum OdcsImportIssueSeverity {
    Blocking = "blocking",
    Info = "info",
    Warning = "warning",
}

/**
 * What one ODCS quality rule becomes in OpenMetadata.
 */
export interface OdcsQualityRuleOutcome {
    /**
     * Column the rule is attached to, if any.
     */
    column?: string;
    /**
     * Name of the rule in the ODCS document.
     */
    name?: string;
    /**
     * `testCase`: the rule runs as a test case. `sla`: the rule sets the contract's refresh
     * frequency. `notExecuted`: the rule is kept with the contract but nothing runs it.
     */
    outcome: Outcome;
    /**
     * Why the rule is not executed, for `notExecuted` outcomes.
     */
    reason?: string;
    /**
     * Name of the test case the rule creates or updates, for `testCase` outcomes.
     */
    testCaseName?: string;
    /**
     * Test definition the rule runs as, for `testCase` outcomes.
     */
    testDefinition?: string;
}

/**
 * `testCase`: the rule runs as a test case. `sla`: the rule sets the contract's refresh
 * frequency. `notExecuted`: the rule is kept with the contract but nothing runs it.
 */
export enum Outcome {
    NotExecuted = "notExecuted",
    Sla = "sla",
    TestCase = "testCase",
}
