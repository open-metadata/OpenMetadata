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
 * Everything an alert can watch and the conditions it can use. Every filter and trigger is
 * written once; sources name the ones they support. The catalog only grows: what an earlier
 * release offered is kept as removed, never deleted, so every saved alert still builds.
 */
export interface AlertCatalog {
    /**
     * Filters, each written once.
     */
    filters: EventFilterRule[];
    /**
     * Sources of Notification alerts.
     */
    notificationSources: AlertCatalogSource[];
    /**
     * Sources of Observability alerts.
     */
    observabilitySources: AlertCatalogSource[];
    /**
     * Who inside the platform alerts can be sent to, for a source that does not say. Offered in
     * the form, never enforced on save.
     */
    recipientCategories: SubscriptionCategory[];
    /**
     * Triggers of an earlier release. Never offered; kept so alerts saved then still build.
     */
    removedTriggers?: EventFilterRule[];
    /**
     * Triggers, each written once.
     */
    triggers: EventFilterRule[];
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
 * One source an alert can watch: its kind, and the filters and triggers it supports, by
 * name.
 */
export interface AlertCatalogSource {
    /**
     * Entity types that can contain this source, so a name filter can be scoped to descendants.
     */
    containerEntities?: string[];
    /**
     * Names of the filters this source supports, in the order they are offered.
     */
    filters?: string[];
    kind:     SourceKind;
    /**
     * Labels by filter or trigger name, where this source calls one differently from its
     * definition.
     */
    labels?: { [key: string]: any };
    /**
     * Name of the source, as alerts store it.
     */
    name: string;
    /**
     * Settings of a filter or trigger for this source, by its name, such as which fields count
     * as the schema of this asset type.
     */
    parameters?: { [key: string]: any };
    /**
     * Who inside the platform alerts on this source can be sent to, when not the catalog's
     * default. Offered in the form, never enforced on save.
     */
    recipientCategories?: SubscriptionCategory[];
    /**
     * A source of an earlier release. Never offered; kept so alerts saved then still build.
     */
    removed?: boolean;
    /**
     * Filters this source supported in an earlier release. Never offered; kept so alerts saved
     * then still build.
     */
    removedFilters?: string[];
    /**
     * Triggers this source supported in an earlier release. Never offered; kept so alerts saved
     * then still build.
     */
    removedTriggers?: string[];
    /**
     * Names of the triggers this source supports, in the order they are offered.
     */
    triggers?: string[];
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
