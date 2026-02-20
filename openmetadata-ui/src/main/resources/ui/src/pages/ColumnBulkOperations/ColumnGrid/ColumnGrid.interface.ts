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

import {
  ColumnChild,
  ColumnGridItem,
  ColumnMetadataGroup,
  ColumnOccurrenceRef,
  MetadataStatus,
} from '../../../generated/api/data/columnGridResponse';
import { TagLabel } from '../../../generated/type/tagLabel';

export interface ColumnGridProps {
  filters?: ColumnGridFilters;
}

export interface ColumnGridFilters {
  entityTypes?: string[];
  serviceName?: string;
  serviceTypes?: string[];
  databaseName?: string;
  schemaName?: string;
  columnNamePattern?: string;
  metadataStatus?: string[];
  domainId?: string;
  tags?: string[];
  glossaryTerms?: string[];
}

export interface ColumnGridRowData {
  id: string;
  columnName: string;
  displayName?: string;
  description?: string;
  dataType?: string;
  tags?: TagLabel[];
  occurrenceCount: number;
  hasVariations: boolean;
  groupId?: string;
  isExpanded?: boolean;
  isGroup?: boolean;
  parentId?: string;
  gridItem?: ColumnGridItem;
  group?: ColumnMetadataGroup;
  isEditing?: boolean;
  editedDisplayName?: string;
  editedDescription?: string;
  editedTags?: TagLabel[];
  // Path information for display
  path?: string;
  additionalPathsCount?: number;
  occurrence?: ColumnOccurrenceRef;
  // Coverage information
  coverageCount?: number;
  totalCount?: number;
  hasCoverage?: boolean;
  hasAnyMetadata?: boolean;
  // Metadata status from API
  metadataStatus?: MetadataStatus;
  // STRUCT nested children
  children?: ColumnChild[];
  isStructChild?: boolean;
  structParentId?: string;
  nestingLevel?: number;
  // Specific occurrence for occurrence rows (links to correct table)
  occurrenceRef?: { columnFQN: string; entityType: string; entityFQN?: string };
}

export interface ColumnGridState {
  rows: ColumnGridRowData[];
  loading: boolean;
  hasMore: boolean;
  cursor?: string;
  totalUniqueColumns: number;
  totalOccurrences: number;
  error?: string;
  selectedRows: Set<string>;
  columnFilters: ColumnFilters;
  quickFilter: string;
  viewSelectedOnly: boolean;
}

export interface ColumnFilters {
  columnName?: string;
  displayName?: string;
  description?: string;
  dataType?: string;
}

export interface BulkUpdatePayload {
  columnName?: string;
  groupId?: string;
  displayName?: string;
  description?: string;
  tags?: TagLabel[];
  occurrences?: Array<{
    columnFQN: string;
    entityType: string;
  }>;
}
