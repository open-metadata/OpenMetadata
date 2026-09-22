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
 * A stage in a playbook's lifecycle. The playbook declares the order; `entityStatus` is the
 * status the handoff workflow is expected to set when the asset arrives here, so the
 * playbook and the workflow agree on one vocabulary.
 */
export interface OnboardingStageDefinition {
    description?: string;
    /**
     * Label shown on the lifecycle rail, e.g. `In Review`.
     */
    displayName?: string;
    /**
     * Status the asset carries while in this stage. Set by the handoff workflow, never by
     * onboarding.
     */
    entityStatus?: EntityStatus;
    /**
     * The stage an asset is created into. Exactly one stage per playbook is the entry stage.
     */
    entryStage?: boolean;
    key:         string;
    /**
     * Position in the lifecycle, ascending.
     */
    order: number;
    /**
     * No further gates after this stage.
     */
    terminal?: boolean;
}

/**
 * Status the asset carries while in this stage. Set by the handoff workflow, never by
 * onboarding.
 *
 * Status of an entity. It is used for governance and is applied to all the entities in the
 * catalog.
 */
export enum EntityStatus {
    Approved = "Approved",
    Archived = "Archived",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
    Unprocessed = "Unprocessed",
}
