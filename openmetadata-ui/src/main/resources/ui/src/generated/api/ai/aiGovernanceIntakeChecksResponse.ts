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
 * AI governance intake checks for an asset.
 */
export interface AIGovernanceIntakeChecksResponse {
    /**
     * Computed intake checks.
     */
    checks: IntakeCheck[];
}

/**
 * Single AI governance intake check result.
 */
export interface IntakeCheck {
    /**
     * Evidence reference associated with the check.
     */
    evidenceRef?: string;
    /**
     * Check name.
     */
    name: string;
    /**
     * Whether the check passes.
     */
    passing: boolean;
}
