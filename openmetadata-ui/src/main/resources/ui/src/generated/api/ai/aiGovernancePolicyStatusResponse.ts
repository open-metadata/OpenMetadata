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
 * Policy evaluation status for an AI asset.
 */
export interface AIGovernancePolicyStatusResponse {
    /**
     * Evaluated policy rules.
     */
    rules: AIGovernancePolicyRuleResult[];
}

/**
 * Evaluation result for one governance policy rule.
 */
export interface AIGovernancePolicyRuleResult {
    /**
     * Rule description.
     */
    description: string;
    /**
     * Rule name.
     */
    name: string;
    /**
     * Rule evaluation status.
     */
    status: string;
    /**
     * Observed value or supporting detail.
     */
    value?: string;
}
