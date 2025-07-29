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
 * Response object for the search entity relationship request from Elastic Search.
 */
export interface EsEntityRelationshipData {
    /**
     * Columns associated with the relationship.
     */
    columns?: Column[];
    /**
     * Description of the relationship.
     */
    description?: string;
    /**
     * Doc Id for the Entity Relationship.
     */
    docId?: string;
    /**
     * Entity in the relationship (upstream/source entity).
     */
    entity?: RelationshipRef;
    /**
     * Related Entity in the relationship (downstream/target entity).
     */
    relatedEntity?: RelationshipRef;
    /**
     * Type of relationship.
     */
    relationshipType?: string;
}

export interface Column {
    /**
     * Column FQN in the entity.
     */
    columnFQN?: string;
    /**
     * Related column FQN in the related entity.
     */
    relatedColumnFQN?: string;
    /**
     * Type of relationship between columns.
     */
    relationshipType?: string;
    [property: string]: any;
}

/**
 * Entity in the relationship (upstream/source entity).
 *
 * Relationship Reference to an Entity.
 *
 * Related Entity in the relationship (downstream/target entity).
 */
export interface RelationshipRef {
    /**
     * FullyQualifiedName Hash of the entity.
     */
    fqnHash?: string;
    /**
     * FullyQualifiedName of the entity.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier of this entity instance.
     */
    id?: string;
    /**
     * Type of the entity.
     */
    type?: string;
}
