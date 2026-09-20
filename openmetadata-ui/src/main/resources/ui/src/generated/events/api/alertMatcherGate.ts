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
 * Whether the alerts of one type have shown enough agreement between the stored condition
 * text and the plan for the plan to decide.
 */
export interface AlertMatcherGate {
    /**
     * Alerts of this type that are compiled from selections.
     */
    alerts?: number;
    /**
     * Names of alerts all of whose events were counted as not comparable. The reports say
     * nothing about them.
     */
    alertsNeverCompared?: string[];
    alertType:            AlertType;
    compared?:            number;
    /**
     * Filters and triggers a stored alert uses that have not answered yes twenty times and no
     * twenty times, and are not on the list of conditions production cannot exercise.
     */
    conditionsLackingCoverage?: string[];
    /**
     * Must be zero.
     */
    disagreements?: number;
    /**
     * Must reach one thousand.
     */
    matchedByAnEngine?: number;
    mode:               MatcherMode;
    notComparable?:     number;
    /**
     * True when every requirement below holds.
     */
    passes:   boolean;
    skipped?: number;
    /**
     * Sources that have alerts and fewer than one hundred matched events.
     */
    sourcesLackingCoverage?: string[];
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
 * stored: the stored condition text decides and the plan is not evaluated. shadow: the
 * stored text decides and the plan is evaluated beside it. plan: the plan decides and the
 * stored text is evaluated beside it.
 */
export enum MatcherMode {
    Plan = "plan",
    Shadow = "shadow",
    Stored = "stored",
}
