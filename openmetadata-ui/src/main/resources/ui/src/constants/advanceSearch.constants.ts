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

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: 'Owner',
    key: 'owner',
  },
  {
    label: 'Tag',
    key: 'tags',
  },
  {
    label: 'Service',
    key: 'service_type',
  },
];

export const TABLE_DROPDOWN_ITEMS = [
  {
    label: 'Column',
    key: 'column_names',
  },

  {
    label: 'Schema',
    key: 'database_schema',
  },
  {
    label: 'Database',
    key: 'database',
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  {
    label: 'Chart',
    key: 'chart_names',
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  {
    label: 'Task',
    key: 'task_names',
  },
];

export const ALL_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  ...TABLE_DROPDOWN_ITEMS,
  ...DASHBOARD_DROPDOWN_ITEMS,
  ...PIPELINE_DROPDOWN_ITEMS,
];
