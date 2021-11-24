/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Add lineage details between two entities
 */
export interface AddLineage {
  /**
   * User provided description of the lineage details.
   */
  description?: string;
  /**
   * Lineage edge details.
   */
  edge: EntitiesEdge;
}

/**
 * Lineage edge details.
 *
 * Edge in the lineage graph from one entity to another using entity references.
 */
export interface EntitiesEdge {
  description?: string;
  /**
   * From entity that is upstream of lineage edge.
   */
  fromEntity?: EntityReference;
  /**
   * To entity that is downstream of lineage edge.
   */
  toEntity?: EntityReference;
}

/**
 * From entity that is upstream of lineage edge.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * To entity that is downstream of lineage edge.
 */
export interface EntityReference {
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Display Name that identifies this entity.
   */
  displayName?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance. For entities such as tables, databases where the name is not
   * unique, fullyQualifiedName is returned in this field.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`,
   * `bigquery`, `snowflake`...
   */
  type: string;
}
