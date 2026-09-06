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

import { SearchIndex } from '../../../enums/search.enum';
import { ObservabilityFilterResourceDescriptor } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import {
  getAlertAiFqnSearchIndexes,
  getAlertAiSourceItems,
} from './AlertAiFormFieldsSearchUtils';

describe('AlertAiFormFieldsSearchUtils', () => {
  it('builds readable source options and preserves the selected source', () => {
    const filterResources = [
      { name: 'table' },
      { name: 'pipeline' },
    ] as ObservabilityFilterResourceDescriptor[];

    expect(getAlertAiSourceItems(filterResources, 'dashboard')).toEqual([
      expect.objectContaining({
        id: 'table',
        label: getEntityNameLabel('table'),
      }),
      expect.objectContaining({
        id: 'pipeline',
        label: getEntityNameLabel('pipeline'),
      }),
      expect.objectContaining({
        id: 'dashboard',
        label: getEntityNameLabel('dashboard'),
      }),
    ]);
  });

  it('builds FQN search indexes from source and container entities', () => {
    expect(
      getAlertAiFqnSearchIndexes('database', ['databaseSchema', 'table'])
    ).toEqual([
      SearchIndex.DATABASE,
      SearchIndex.DATABASE_SCHEMA,
      SearchIndex.TABLE,
    ]);
  });
});
