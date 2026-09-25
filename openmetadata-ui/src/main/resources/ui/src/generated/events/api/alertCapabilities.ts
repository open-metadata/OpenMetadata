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
 * What a selection of sources supports and what it cannot reach. The form, the save and the
 * matching plan all derive from the same place, so the form cannot offer something the save
 * would reject.
 */
export interface AlertCapabilities {
    alertType: AlertType;
    /**
     * Entity types a name filter can be scoped to: the union over the selected sources.
     */
    containerEntities?: string[];
    /**
     * Event types at least one selected source emits. Values to match, never enforced at save.
     */
    eventTypes?: string[];
    /**
     * Filters every selected source supports.
     */
    filters: AlertConditionCapability[];
    /**
     * Who inside the platform alerts on the selected sources can be sent to: a category any of
     * them offers. Offered in the form, never enforced on save.
     */
    recipientCategories?: SubscriptionCategory[];
    /**
     * Every source of the alert type.
     */
    sources: AlertSourceCapability[];
    /**
     * Triggers at least one selected source supports.
     */
    triggers: AlertConditionCapability[];
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
 * A filter or a trigger the selection supports, with the selected sources it applies to.
 */
export interface AlertConditionCapability {
    condition: EventFilterRule;
    /**
     * A filter applies to every selected source. A trigger applies only to those that support
     * it.
     */
    sources: string[];
}

/**
 * Describes an Event Filter Rule
 */
export interface EventFilterRule {
    /**
     * Arguments to the Condition.
     */
    arguments?: string[];
    /**
     * Expression in SpEL used for matching of a `Rule` based on entity, resource, and
     * environmental attributes.
     */
    condition: string;
    /**
     * Description of the Event Filter Rule.
     */
    description?: string;
    /**
     * Display Name of the Filter.
     */
    displayName?: string;
    effect:       Effect;
    /**
     * FullyQualifiedName in the form `eventSubscription.eventFilterRuleName`.
     */
    fullyQualifiedName?: string;
    inputType?:          InputType;
    /**
     * Name of this Event Filter.
     */
    name?: string;
    /**
     * Prefix Condition to be applied to the Condition.
     */
    prefixCondition?: PrefixCondition;
}

export enum Effect {
    Exclude = "exclude",
    Include = "include",
}

export enum InputType {
    None = "none",
    Runtime = "runtime",
    Static = "static",
}

/**
 * Prefix Condition to be applied to the Condition.
 */
export enum PrefixCondition {
    And = "AND",
    Or = "OR",
}

/**
 * Subscription Endpoint Type.
 */
export enum SubscriptionCategory {
    Admins = "Admins",
    Assignees = "Assignees",
    External = "External",
    Followers = "Followers",
    Mentions = "Mentions",
    Owners = "Owners",
    Teams = "Teams",
    Users = "Users",
}

/**
 * One source of an alert type, as it relates to a selection of sources.
 */
export interface AlertSourceCapability {
    /**
     * False when adding this source to the selection would break a rule. The form disables it
     * and shows the reason.
     */
    canJoin?: boolean;
    kind:     SourceKind;
    name:     string;
    /**
     * Why the source cannot join the selection.
     */
    reason?:   string;
    selected?: boolean;
    /**
     * For a selected source: why, with what has been chosen so far, it can never produce a
     * match. The alert still saves.
     */
    warning?: string;
}

/**
 * Source names look alike but mean different things. Entity: the change events of one asset
 * type. Activity: collaboration items. All: the wildcard.
 */
export enum SourceKind {
    Activity = "activity",
    All = "all",
    Entity = "entity",
}
