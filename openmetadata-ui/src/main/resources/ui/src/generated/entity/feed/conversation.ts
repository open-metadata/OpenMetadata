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
 * A bounded conversation root whose replies are stored separately.
 */
export interface Conversation {
    /**
     * Entity or entity field this conversation is about.
     */
    about: string;
    /**
     * ActivityEvent associated with an Activity-source conversation.
     */
    activityEventId?: string;
    /**
     * Timestamp of the associated ActivityEvent.
     */
    activityTimestamp?: number;
    /**
     * Timestamp when the conversation was created.
     */
    createdAt: number;
    /**
     * User who created a User-source conversation.
     */
    createdBy?: EntityReference;
    /**
     * Domains inherited from the target entity.
     */
    domains?: EntityReference[];
    /**
     * Reference to the entity identified by about.
     */
    entityRef: EntityReference;
    /**
     * Link to this conversation.
     */
    href?: string;
    /**
     * Unique identifier for the conversation.
     */
    id:              string;
    impersonatedBy?: string;
    /**
     * Root message for a User-source conversation.
     */
    message?: string;
    /**
     * Reactions on the root message.
     */
    reactions?: Reaction[];
    /**
     * A bounded window of recent replies.
     */
    replies?: ConversationReply[];
    /**
     * Number of replies in the conversation.
     */
    replyCount: number;
    /**
     * Whether the conversation has been resolved.
     */
    resolved: boolean;
    source:   ConversationSource;
    /**
     * Timestamp when the conversation was last updated.
     */
    updatedAt: number;
    /**
     * User who last updated the conversation.
     */
    updatedBy?: string;
}

/**
 * User who created a User-source conversation.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Domains inherited from the target entity.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the entity identified by about.
 *
 * User who reacted.
 *
 * User who created the reply.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Reactions on the root message.
 *
 * This schema defines the reaction to an entity or a conversation in the activity feeds.
 */
export interface Reaction {
    reactionType: ReactionType;
    /**
     * User who reacted.
     */
    user: EntityReference;
}

/**
 * Type of reaction.
 */
export enum ReactionType {
    Confused = "confused",
    Eyes = "eyes",
    Heart = "heart",
    Hooray = "hooray",
    Laugh = "laugh",
    Rocket = "rocket",
    ThumbsDown = "thumbsDown",
    ThumbsUp = "thumbsUp",
}

/**
 * A reply in a conversation.
 */
export interface ConversationReply {
    /**
     * User who created the reply.
     */
    author: EntityReference;
    /**
     * Conversation containing this reply.
     */
    conversationId: string;
    /**
     * Timestamp when the reply was created.
     */
    createdAt: number;
    /**
     * Unique identifier for the reply.
     */
    id:              string;
    impersonatedBy?: string;
    /**
     * Reply content in Markdown format.
     */
    message: string;
    /**
     * Reactions on this reply.
     */
    reactions?: Reaction[];
    /**
     * Timestamp when the reply was last updated.
     */
    updatedAt: number;
    /**
     * User who last updated the reply.
     */
    updatedBy?: string;
}

/**
 * Origin of a conversation.
 */
export enum ConversationSource {
    Activity = "Activity",
    User = "User",
}
