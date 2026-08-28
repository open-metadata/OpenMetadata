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
  Code01,
  Database01,
  FileCode01,
  FolderCode,
  LayersThree01,
  Table,
} from '@untitledui/icons';
import { ServiceConnectionFilterPatternFields } from '../../../../enums/ServiceConnection.enum';
import { FilterOperator, IconComponent } from './FiltersConfigForm.types';

export const FORM_TEST_ID = 'filters-config-form';

export const REGEX_SPECIAL_CHARS = new Set([
  '.',
  '*',
  '+',
  '?',
  '^',
  '$',
  '{',
  '}',
  '(',
  ')',
  '|',
  '[',
  ']',
]);

export const FILTER_LABEL_KEYS: Partial<
  Record<ServiceConnectionFilterPatternFields, string>
> = {
  [ServiceConnectionFilterPatternFields.API_COLLECTION_FILTER_PATTERN]:
    'label.api-collection-plural',
  [ServiceConnectionFilterPatternFields.CHART_FILTER_PATTERN]:
    'label.chart-plural',
  [ServiceConnectionFilterPatternFields.CLASSIFICATION_FILTER_PATTERN]:
    'label.classification-plural',
  [ServiceConnectionFilterPatternFields.CONTAINER_FILTER_PATTERN]:
    'label.container-plural',
  [ServiceConnectionFilterPatternFields.DASHBOARD_FILTER_PATTERN]:
    'label.dashboard-plural',
  [ServiceConnectionFilterPatternFields.DATA_MODEL_FILTER_PATTERN]:
    'label.data-model-plural',
  [ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN]:
    'label.database-plural',
  [ServiceConnectionFilterPatternFields.DIRECTORY_FILTER_PATTERN]:
    'label.directory-plural',
  [ServiceConnectionFilterPatternFields.FILE_FILTER_PATTERN]:
    'label.file-plural',
  [ServiceConnectionFilterPatternFields.ML_MODEL_FILTER_PATTERN]:
    'label.ml-model-plural',
  [ServiceConnectionFilterPatternFields.PIPELINE_FILTER_PATTERN]:
    'label.pipeline-plural',
  [ServiceConnectionFilterPatternFields.PROJECT_FILTER_PATTERN]:
    'label.project-plural',
  [ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN]:
    'label.schema-plural',
  [ServiceConnectionFilterPatternFields.SEARCH_INDEX_FILTER_PATTERN]:
    'label.search-index-plural',
  [ServiceConnectionFilterPatternFields.SPREADSHEET_FILTER_PATTERN]:
    'label.spreadsheet-plural',
  [ServiceConnectionFilterPatternFields.STORED_PROCEDURE_FILTER_PATTERN]:
    'label.stored-procedure-plural',
  [ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN]:
    'label.table-plural',
  [ServiceConnectionFilterPatternFields.TOPIC_FILTER_PATTERN]:
    'label.topic-plural',
  [ServiceConnectionFilterPatternFields.WORKSHEET_FILTER_PATTERN]:
    'label.worksheet-plural',
};

export const FILTER_SINGLE_LABEL_KEYS: Partial<
  Record<ServiceConnectionFilterPatternFields, string>
> = {
  [ServiceConnectionFilterPatternFields.API_COLLECTION_FILTER_PATTERN]:
    'label.api-collection',
  [ServiceConnectionFilterPatternFields.CHART_FILTER_PATTERN]: 'label.chart',
  [ServiceConnectionFilterPatternFields.CLASSIFICATION_FILTER_PATTERN]:
    'label.classification',
  [ServiceConnectionFilterPatternFields.CONTAINER_FILTER_PATTERN]:
    'label.container',
  [ServiceConnectionFilterPatternFields.DASHBOARD_FILTER_PATTERN]:
    'label.dashboard',
  [ServiceConnectionFilterPatternFields.DATA_MODEL_FILTER_PATTERN]:
    'label.data-model',
  [ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN]:
    'label.database',
  [ServiceConnectionFilterPatternFields.DIRECTORY_FILTER_PATTERN]:
    'label.directory',
  [ServiceConnectionFilterPatternFields.FILE_FILTER_PATTERN]: 'label.file',
  [ServiceConnectionFilterPatternFields.ML_MODEL_FILTER_PATTERN]:
    'label.ml-model',
  [ServiceConnectionFilterPatternFields.PIPELINE_FILTER_PATTERN]:
    'label.pipeline',
  [ServiceConnectionFilterPatternFields.PROJECT_FILTER_PATTERN]:
    'label.project',
  [ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN]: 'label.schema',
  [ServiceConnectionFilterPatternFields.SEARCH_INDEX_FILTER_PATTERN]:
    'label.search-index',
  [ServiceConnectionFilterPatternFields.SPREADSHEET_FILTER_PATTERN]:
    'label.spreadsheet',
  [ServiceConnectionFilterPatternFields.STORED_PROCEDURE_FILTER_PATTERN]:
    'label.stored-procedure',
  [ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN]: 'label.table',
  [ServiceConnectionFilterPatternFields.TOPIC_FILTER_PATTERN]: 'label.topic',
  [ServiceConnectionFilterPatternFields.WORKSHEET_FILTER_PATTERN]:
    'label.worksheet',
};

export const FILTER_ICONS: Partial<
  Record<ServiceConnectionFilterPatternFields, IconComponent>
> = {
  [ServiceConnectionFilterPatternFields.API_COLLECTION_FILTER_PATTERN]:
    FileCode01,
  [ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN]: Database01,
  [ServiceConnectionFilterPatternFields.DIRECTORY_FILTER_PATTERN]: FolderCode,
  [ServiceConnectionFilterPatternFields.FILE_FILTER_PATTERN]: FileCode01,
  [ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN]: LayersThree01,
  [ServiceConnectionFilterPatternFields.STORED_PROCEDURE_FILTER_PATTERN]:
    Code01,
  [ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN]: Table,
};

export const OPERATOR_LABEL_KEYS: Record<FilterOperator, string> = {
  contains: 'label.contains-lowercase',
  endsWith: 'label.ends-with',
  is: 'label.is-exactly',
  regex: 'label.matches-regex',
  startsWith: 'label.starts-with',
};
