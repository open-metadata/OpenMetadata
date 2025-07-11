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
 * Semantics validation details for data contract.
 */
export interface SemanticsValidation {
    /**
     * Number of semantics rules failed.
     */
    failed?: number;
    /**
     * List of rules that failed validation.
     */
    failedRules?: FailedRule[];
    /**
     * Number of semantics rules passed.
     */
    passed?: number;
    /**
     * Total number of semantics rules.
     */
    total?: number;
}

export interface FailedRule {
    reason?:   string;
    ruleName?: string;
}
