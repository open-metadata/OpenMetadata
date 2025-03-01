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
import { Property } from '../pages/SearchSettingsPage/searchSettings.interface';
import { GlobalSettingOptions } from './GlobalSettings.constants';

export const globalSettings: Property[] = [
  { key: 'maxAggregateSize', label: 'Max Aggregate Size' },
  { key: 'maxResultHits', label: 'Max Result Hits' },
  { key: 'maxAnalyzedOffset', label: 'Max Analyzed Offset' },
];

export const defaultFilters = [
  'Data Assets',
  'Domain',
  'Owners',
  'Tag',
  'Tier',
  'Certification',
  'Service',
  'Service Type',
  'Tier',
  'Certification',
  'Service',
  'Service Type',
];

const COMMON_FIELDS: string[] = [
  'name',
  'displayName',
  'description',
  'fullyQualifiedName',
  'fullyQualifiedNameParts',
];

export const ENTITY_FIELDS = (entityType: string): string[] => {
  switch (entityType) {
    case GlobalSettingOptions.API_ENDPOINT:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.DASHBOARD_DATA_MODELS:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.TABLE:
      return [
        ...COMMON_FIELDS,
        'columns.name',
        'columns.displayName',
        'columns.description',
        'columns.children.name',
      ];

    case GlobalSettingOptions.STORED_PROCEDURE:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.DASHBOARD:
      return [...COMMON_FIELDS, 'charts.name', 'charts.displayName'];

    case GlobalSettingOptions.PIPELINE:
      return [...COMMON_FIELDS, 'tasks.name', 'tasks.description'];

    case GlobalSettingOptions.TOPIC:
      return [
        ...COMMON_FIELDS,
        'messageSchema.schemaText',
        'messageSchema.schemaFields.name.keyword',
        'messageSchema.schemaFields.description',
        'messageSchema.schemaFields.children.name',
        'messageSchema.schemaFields.children.keyword',
      ];

    case GlobalSettingOptions.CONTAINER:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.ML_MODEL:
      return [...COMMON_FIELDS, 'mlFeatures.name', 'mlFeatures.description'];

    case GlobalSettingOptions.GLOSSARY_TERM:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.QUERY:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.DATA_ASSET:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.TAG:
      return [...COMMON_FIELDS];

    case GlobalSettingOptions.TEST_CASE:
      return [...COMMON_FIELDS];

    default:
      return COMMON_FIELDS;
  }
};
