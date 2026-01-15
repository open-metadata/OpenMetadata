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

import { ExploreQuickFilterField } from '../../../../components/Explore/ExplorePage.interface';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';

export const COLUMN_GRID_DEFAULT_QUICK_FILTERS = [EntityFields.SERVICE];

export const COLUMN_GRID_FILTERS: ExploreQuickFilterField[] = [
  {
    label: 'label.service',
    key: EntityFields.SERVICE,
  },
];

// Common data types for filter
export const DATA_TYPE_OPTIONS = [
  { key: 'STRING', label: 'STRING' },
  { key: 'VARCHAR', label: 'VARCHAR' },
  { key: 'INT', label: 'INT' },
  { key: 'BIGINT', label: 'BIGINT' },
  { key: 'FLOAT', label: 'FLOAT' },
  { key: 'DOUBLE', label: 'DOUBLE' },
  { key: 'BOOLEAN', label: 'BOOLEAN' },
  { key: 'DATE', label: 'DATE' },
  { key: 'TIMESTAMP', label: 'TIMESTAMP' },
  { key: 'DECIMAL', label: 'DECIMAL' },
  { key: 'NUMERIC', label: 'NUMERIC' },
  { key: 'TEXT', label: 'TEXT' },
  { key: 'CHAR', label: 'CHAR' },
  { key: 'BINARY', label: 'BINARY' },
  { key: 'ARRAY', label: 'ARRAY' },
  { key: 'MAP', label: 'MAP' },
  { key: 'STRUCT', label: 'STRUCT' },
  { key: 'JSON', label: 'JSON' },
  { key: 'UUID', label: 'UUID' },
];

// Metadata status options
export const METADATA_STATUS_OPTIONS = [
  { key: 'MISSING', label: 'Missing' },
  { key: 'INCOMPLETE', label: 'Incomplete' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'COMPLETE', label: 'Complete' },
  { key: 'REVIEWED', label: 'Reviewed' },
  { key: 'APPROVED', label: 'Approved' },
];

export const ASSET_TYPE_OPTIONS = [
  { key: 'table', label: 'Table' },
  { key: 'dashboardDataModel', label: 'Dashboard Data Model' },
  { key: 'topic', label: 'Topic' },
  { key: 'container', label: 'Container' },
  { key: 'searchIndex', label: 'Search Index' },
];
