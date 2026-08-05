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
import { EntityType } from '../../../enums/entity.enum';

const LABEL_COLUMN_PLURAL = 'label.column-plural' as const;
const LABEL_FIELD_PLURAL = 'label.field-plural' as const;

/**
 * Entity type → i18n key for the child list label. Used by EntityDetailsSection
 * search placeholder and by getEntityChildrenAndLabel (EntityLineageUtils).
 * e.g. TABLE → "Columns", DASHBOARD → "Charts", PIPELINE → "Tasks"
 */
export const SEARCH_PLACEHOLDER_MAP: Record<string, string> = {
  [EntityType.TABLE]: LABEL_COLUMN_PLURAL,
  [EntityType.DASHBOARD_DATA_MODEL]: LABEL_COLUMN_PLURAL,
  [EntityType.TOPIC]: LABEL_FIELD_PLURAL,
  [EntityType.CONTAINER]: LABEL_COLUMN_PLURAL,
  [EntityType.PIPELINE]: 'label.task-plural',
  [EntityType.DASHBOARD]: 'label.chart-plural',
  [EntityType.SEARCH_INDEX]: LABEL_FIELD_PLURAL,
  [EntityType.API_ENDPOINT]: LABEL_FIELD_PLURAL,
  [EntityType.API_COLLECTION]: 'label.api-endpoint-plural',
  [EntityType.DATABASE_SCHEMA]: 'label.table-plural',
  [EntityType.DATABASE]: 'label.database-schema-plural',
  [EntityType.MLMODEL]: 'label.feature-plural',
};
