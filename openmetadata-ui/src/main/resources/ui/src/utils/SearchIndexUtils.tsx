/*
 *  Copyright 2023 Collate.
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

import { uniqueId } from 'lodash';
import React from 'react';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, TabSpecificField } from '../enums/entity.enum';
import { SearchIndexField } from '../generated/entity/data/searchIndex';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.FIELDS},${TabSpecificField.FOLLOWERS},${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.DOMAIN},${TabSpecificField.VOTES},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.EXTENSION}`;

export const makeData = (
  columns: SearchIndexField[] = []
): Array<SearchIndexField & { id: string }> => {
  return columns.map((column) => ({
    ...column,
    id: uniqueId(column.name),
    children: column.children ? makeData(column.children) : undefined,
  }));
};

export const getSearchIndexDetailsPageDefaultLayout = (tab: EntityTabs) => {
  switch (tab) {
    case EntityTabs.SCHEMA:
      return [
        {
          h: 2,
          i: DetailPageWidgetKeys.DESCRIPTION,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: 8,
          i: DetailPageWidgetKeys.TABLE_SCHEMA,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
          w: 2,
          x: 6,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.DATA_PRODUCTS,
          w: 2,
          x: 6,
          y: 1,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.TAGS,
          w: 2,
          x: 6,
          y: 2,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.GLOSSARY_TERMS,
          w: 2,
          x: 6,
          y: 3,
          static: false,
        },
        {
          h: 3,
          i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
          w: 2,
          x: 6,
          y: 4,
          static: false,
        },
      ];

    default:
      return [];
  }
};

export const getSearchIndexWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  return <CommonWidgets widgetConfig={widgetConfig} />;
};
