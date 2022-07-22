/*
 *  Copyright 2021 Collate
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

import { AdvancedFields } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';

export enum AdvancedSearchFieldKey {
  Owner = 'owner.name',
  Tag = 'tags',
  Service = 'service.name',
  Schema = 'databaseSchema.name',
  Columns = 'columns',
  Database = 'database.name',
  Chart = 'chars.displayName',
  Task = 'tasks.dispalyName',
}

const common = [
  {
    key: AdvancedSearchFieldKey.Owner,
    label: 'Owner',
  },
  {
    key: AdvancedSearchFieldKey.Tag,
    label: 'Tag',
  },
  {
    key: AdvancedSearchFieldKey.Service,
    label: 'Service',
    searchField: AdvancedFields.SERVICE,
  },
];

export const TABLE_DROPDOWN_ITEMS = [
  ...common,
  {
    key: AdvancedSearchFieldKey.Database,
    label: 'Database',
    searchField: AdvancedFields.DATABASE,
    searchIndex: SearchIndex.TABLE,
  },
  {
    key: AdvancedSearchFieldKey.Schema,
    label: 'Schema',
    searchField: AdvancedFields.SCHEMA,
    searchIndex: SearchIndex.TABLE,
  },
  {
    key: AdvancedSearchFieldKey.Columns,
    label: 'Column',
    searchField: AdvancedFields.COLUMN,
    SearchIndex: SearchIndex.TABLE,
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  ...common,
  {
    key: AdvancedSearchFieldKey.Chart,
    label: 'Chart',
    searchField: AdvancedFields.CHART,
    searchIndex: SearchIndex.DASHBOARD,
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  ...common,
  {
    key: AdvancedSearchFieldKey.Task,
    label: 'Task',
    searchField: AdvancedFields.TASK,
    SearchIndex: SearchIndex.PIPELINE,
  },
];
