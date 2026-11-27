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
 * A selection of sources, and optionally what has been chosen so far, for which the form
 * asks what can still be chosen.
 */
export interface AlertCapabilitiesRequest {
    alertType: AlertType;
    /**
     * The filters and triggers chosen so far, so that a source they can never reach is pointed
     * out.
     */
    input?: AlertFilteringInput;
    /**
     * Names of the selected sources. Empty to ask what can be selected at all.
     */
    sources?: string[];
}

/**
 * Type of Alerts supported.
 */
export enum AlertType {
    ActivityFeed = "ActivityFeed",
    Custom = "Custom",
    GovernanceWorkflowChangeEvent = "GovernanceWorkflowChangeEvent",
    Notification = "Notification",
    Observability = "Observability",
}

/**
 * The filters and triggers chosen so far, so that a source they can never reach is pointed
 * out.
 *
 * Observability of the event subscription.
 */
export interface AlertFilteringInput {
    /**
     * List of filters for the event subscription.
     */
    actions?: ArgumentsInput[];
    /**
     * List of filters for the event subscription.
     */
    filters?: ArgumentsInput[];
}

/**
 * Observability Filters for Event Subscription.
 */
export interface ArgumentsInput {
    /**
     * Arguments List
     */
    arguments?: Argument[];
    effect?:    Effect;
    /**
     * Name of the filter
     */
    name?: string;
    /**
     * Prefix Condition for the filter.
     */
    prefixCondition?: PrefixCondition;
}

/**
 * Argument for the filter.
 */
export interface Argument {
    /**
     * Value of the Argument
     */
    input?: string[];
    /**
     * Name of the Argument
     */
    name?: string;
}

export enum Effect {
    Exclude = "exclude",
    Include = "include",
}

/**
 * Prefix Condition for the filter.
 *
 * Prefix Condition to be applied to the Condition.
 */
export enum PrefixCondition {
    And = "AND",
    Or = "OR",
}
