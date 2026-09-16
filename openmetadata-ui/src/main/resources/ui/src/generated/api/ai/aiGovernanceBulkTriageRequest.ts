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
 * Request to bulk-triage shadow AI detections.
 */
export interface AIGovernanceBulkTriageRequest {
    /**
     * Triage action. Dismiss rejects the asset; other values register it for review.
     */
    action?: string;
    /**
     * AI assets to triage.
     */
    items?: AIGovernanceBulkTriageItem[];
    /**
     * Reason supplied when dismissing or registering the detections.
     */
    reason?: string;
}

/**
 * AI asset to triage.
 */
export interface AIGovernanceBulkTriageItem {
    /**
     * Type of AI asset to triage.
     */
    entityType: string;
    /**
     * Identifier of the AI asset to triage.
     */
    id: string;
}
