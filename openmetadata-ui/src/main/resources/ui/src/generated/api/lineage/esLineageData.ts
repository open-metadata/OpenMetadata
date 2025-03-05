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
 * Response object for the search lineage request from Elastic Search.
 */
export interface EsLineageData {
    /**
     * Columns associated.
     */
    columns?: ColumnLineage[];
    /**
     * Description.
     */
    description?: string;
    /**
     * Doc Id for the Lineage.
     */
    docId?: string;
    /**
     * From Entity.
     */
    fromEntity?: RelationshipRef;
    /**
     * Pipeline in case pipeline is present between entities.
     */
    pipeline?: any;
    /**
     * Pipeline Entity or Stored procedure.
     */
    pipelineEntityType?: string;
    /**
     * Source of the Lineage.
     */
    source?: string;
    /**
     * Sql Query associated.
     */
    sqlQuery?: string;
    /**
     * To Entity.
     */
    toEntity?: RelationshipRef;
}

export interface ColumnLineage {
    /**
     * One or more source columns identified by fully qualified column name used by
     * transformation function to create destination column.
     */
    fromColumns?: string[];
    /**
     * Transformation function applied to source columns to create destination column. That is
     * `function(fromColumns) -> toColumn`.
     */
    function?: string;
    /**
     * Destination column identified by fully qualified column name created by the
     * transformation of source columns.
     */
    toColumn?: string;
    [property: string]: any;
}

/**
 * From Entity.
 *
 * Relationship Reference to an Entity.
 *
 * To Entity.
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
    [property: string]: any;
}
