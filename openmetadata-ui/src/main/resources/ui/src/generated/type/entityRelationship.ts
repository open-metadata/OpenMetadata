/*
 *  Copyright 2025 Collate.
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
 * This schema defines the EntityRelationship type used for establishing relationship
 * between two entities. EntityRelationship is used for capturing relationships from one
 * entity to another. For example, a database contains tables.
 */
export interface EntityRelationship {
    /**
     * `true` indicates the relationship has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Type of the entity from which the relationship originates. Examples: `database`, `table`,
     * `metrics` ...
     */
    fromEntity: string;
    /**
     * Fully qualified name of the entity from which the relationship originates.
     */
    fromFQN?: string;
    /**
     * Unique identifier that identifies the entity from which the relationship originates.
     */
    fromId?: string;
    /**
     * Describes relationship between the two entities as an integer.
     */
    relation?: number;
    /**
     * Describes relationship between the two entities. Eg: Database --- Contains --> Table.
     */
    relationshipType: RelationshipType;
    /**
     * Type of the entity towards which the relationship refers to. Examples: `database`,
     * `table`, `metrics` ...
     */
    toEntity: string;
    /**
     * Fully qualified name of the entity towards which the relationship refers to.
     */
    toFQN?: string;
    /**
     * Unique identifier that identifies the entity towards which the relationship refers to.
     */
    toId?: string;
}

/**
 * Describes relationship between the two entities. Eg: Database --- Contains --> Table.
 *
 * This enum captures all the relationships between Catalog entities. Note that the
 * relationship from is a Strong entity and to is Weak entity when possible.
 */
export enum RelationshipType {
    AddressedTo = "addressedTo",
    AppliedTo = "appliedTo",
    Contains = "contains",
    CreatedBy = "createdBy",
    DefaultsTo = "defaultsTo",
    EditedBy = "editedBy",
    Expert = "expert",
    Follows = "follows",
    Has = "has",
    IsAbout = "isAbout",
    JoinedWith = "joinedWith",
    MentionedIn = "mentionedIn",
    Owns = "owns",
    ParentOf = "parentOf",
    ReactedTo = "reactedTo",
    RelatedTo = "relatedTo",
    RelatesTo = "relatesTo",
    RepliedTo = "repliedTo",
    Reviews = "reviews",
    TestedBy = "testedBy",
    Upstream = "upstream",
    Uses = "uses",
    Voted = "voted",
}
