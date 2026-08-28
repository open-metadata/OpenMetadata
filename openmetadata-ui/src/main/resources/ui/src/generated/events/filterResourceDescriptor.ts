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
 * Filter descriptor
 */
export interface FilterResourceDescriptor {
    /**
     * Ancestor entity types whose fully qualified name is a prefix of this resource's FQN (e.g.
     * a databaseSchema is contained by databaseService and database). Lets an Entity FQN filter
     * scope an alert to all descendants of a parent.
     */
    containerEntities?: string[];
    /**
     * Name of the resource. For entity related resources, resource name is same as the entity
     * name. Some resources such as lineage are not entities but are resources.
     */
    name?: string;
    /**
     * List of actions supported filters by the resource.
     */
    supportedActions?: EventFilterRule[];
    /**
     * Event types an alert on this resource can actually receive, so the alert builder should
     * offer only these. Advisory, not enforced: a subscription holding an event type outside
     * this list still saves, it just never matches an event. Derived server-side from what the
     * event emitters produce, not declared in EventSubResourceDescriptor.json.
     */
    supportedEventTypes?: EventType[];
    /**
     * List of operations supported filters by the resource.
     */
    supportedFilters?: EventFilterRule[];
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
 * Type of event.
 */
export enum EventType {
    EntityCreated = "entityCreated",
    EntityDeleted = "entityDeleted",
    EntityFieldsChanged = "entityFieldsChanged",
    EntityLineageAdded = "entityLineageAdded",
    EntityLineageDeleted = "entityLineageDeleted",
    EntityLineageUpdated = "entityLineageUpdated",
    EntityNoChange = "entityNoChange",
    EntityRestored = "entityRestored",
    EntitySoftDeleted = "entitySoftDeleted",
    EntityUpdated = "entityUpdated",
    LogicalTestCaseAdded = "logicalTestCaseAdded",
    PostCreated = "postCreated",
    PostUpdated = "postUpdated",
    SuggestionAccepted = "suggestionAccepted",
    SuggestionCreated = "suggestionCreated",
    SuggestionDeleted = "suggestionDeleted",
    SuggestionRejected = "suggestionRejected",
    SuggestionUpdated = "suggestionUpdated",
    TaskClosed = "taskClosed",
    TaskCreated = "taskCreated",
    TaskResolved = "taskResolved",
    TaskUpdated = "taskUpdated",
    ThreadCreated = "threadCreated",
    ThreadUpdated = "threadUpdated",
    UserLogin = "userLogin",
    UserLogout = "userLogout",
}
