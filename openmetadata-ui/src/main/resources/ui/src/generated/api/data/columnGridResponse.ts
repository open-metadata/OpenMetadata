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

import { TagLabel } from '../../type/tagLabel';

/**
 * Response containing all unique columns grouped by metadata similarity for grid-based editing.
 */
export interface ColumnGridResponse {
  /**
   * List of unique column names with their metadata groups.
   */
  columns: ColumnGridItem[];
  /**
   * Cursor for pagination (Base64-encoded). Use this in the next request to get the next page of results.
   */
  cursor?: string;
  /**
   * Total number of column occurrences across all entities.
   */
  totalOccurrences: number;
  /**
   * Total number of unique column names.
   */
  totalUniqueColumns: number;
}

/**
 * A unique column name with its metadata groups.
 */
export interface ColumnGridItem {
  /**
   * Name of the column.
   */
  columnName: string;
  /**
   * Metadata groups - columns with identical metadata are grouped together.
   */
  groups: ColumnMetadataGroup[];
  /**
   * Whether this column has different metadata across occurrences.
   */
  hasVariations: boolean;
  /**
   * Total number of occurrences for this column name.
   */
  totalOccurrences: number;
}

/**
 * A group of columns with identical metadata.
 */
export interface ColumnMetadataGroup {
  /**
   * Data type (common across all columns in this group).
   */
  dataType?: string;
  /**
   * Description (common across all columns in this group).
   */
  description?: string;
  /**
   * Display name (common across all columns in this group).
   */
  displayName?: string;
  /**
   * Unique identifier for this metadata group (hash of metadata values).
   */
  groupId: string;
  /**
   * Number of column occurrences in this group.
   */
  occurrenceCount: number;
  /**
   * List of column occurrences in this group.
   */
  occurrences: ColumnOccurrenceRef[];
  /**
   * Tags (common across all columns in this group).
   */
  tags?: TagLabel[];
}

/**
 * Reference to a column occurrence.
 */
export interface ColumnOccurrenceRef {
  /**
   * Fully qualified name of the column.
   */
  columnFQN: string;
  /**
   * Name of the database (if applicable).
   */
  databaseName?: string;
  /**
   * Display name of the parent entity.
   */
  entityDisplayName?: string;
  /**
   * Fully qualified name of the parent entity.
   */
  entityFQN: string;
  /**
   * Type of entity containing the column.
   */
  entityType: string;
  /**
   * Name of the schema (if applicable).
   */
  schemaName?: string;
  /**
   * Name of the service.
   */
  serviceName?: string;
}
