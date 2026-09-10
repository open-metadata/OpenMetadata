/*
 *  Copyright 2026 Collate.
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

import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import tableClassBase from './TableClassBase';

describe('TableClassBase.getWidgetHeight', () => {
  it.each([
    [DetailPageWidgetKeys.DESCRIPTION, 2],
    [DetailPageWidgetKeys.TABLE_SCHEMA, 8.5],
    [DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES, 2],
    [DetailPageWidgetKeys.DATA_PRODUCTS, 2],
    [DetailPageWidgetKeys.TAGS, 2],
    [DetailPageWidgetKeys.GLOSSARY_TERMS, 2],
    [DetailPageWidgetKeys.TABLE_CONSTRAINTS, 2],
    [DetailPageWidgetKeys.PARTITIONED_KEYS, 2],
    [DetailPageWidgetKeys.TABLE_ALIASES, 2],
  ])('should return the configured height for %s', (widgetKey, height) => {
    expect(tableClassBase.getWidgetHeight(widgetKey)).toBe(height);
  });

  it.each([
    DetailPageWidgetKeys.CUSTOM_PROPERTIES,
    DetailPageWidgetKeys.ANNOUNCEMENTS,
    DetailPageWidgetKeys.DIRECTORY_CHILDREN,
    '',
    'unknown-widget',
  ])('should fall back to height 1 for %s', (widgetKey) => {
    expect(tableClassBase.getWidgetHeight(widgetKey)).toBe(1);
  });
});
