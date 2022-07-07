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

import { isUndefined } from 'lodash';
import {
  ALL_DROPDOWN_ITEMS,
  COMMON_DROPDOWN_ITEMS,
  DASHBOARD_DROPDOWN_ITEMS,
  PIPELINE_DROPDOWN_ITEMS,
  TABLE_DROPDOWN_ITEMS,
} from '../constants/advanceSearch.constants';
import { AdvancedFields } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';

export const getDropDownItems = (index: string) => {
  switch (index) {
    case SearchIndex.TABLE:
      return [...TABLE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.TOPIC:
      return [...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.DASHBOARD:
      return [...DASHBOARD_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.PIPELINE:
      return [...PIPELINE_DROPDOWN_ITEMS, ...COMMON_DROPDOWN_ITEMS];

    case SearchIndex.MLMODEL:
      return [
        ...COMMON_DROPDOWN_ITEMS.filter((item) => item.key !== 'service_type'),
      ];

    default:
      return [];
  }
};

export const getItemLabel = (key: string) => {
  const item = ALL_DROPDOWN_ITEMS.find((dItem) => dItem.key === key);

  return !isUndefined(item) ? item.label : 'label';
};

export const getAdvancedField = (field: string) => {
  switch (field) {
    case 'columns.name':
      return AdvancedFields.COLUMN;

    case 'databaseSchema.name':
      return AdvancedFields.SCHEMA;

    case 'database.name':
      return AdvancedFields.DATABASE;

    case 'charts.displayName':
      return AdvancedFields.CHART;

    case 'tasks.displayName':
      return AdvancedFields.TASK;

    case 'service.name':
      return AdvancedFields.SERVICE;

    default:
      return;
  }
};
