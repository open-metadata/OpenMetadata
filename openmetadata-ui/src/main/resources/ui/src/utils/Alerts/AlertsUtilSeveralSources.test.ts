/*
 *  Copyright 2024 Collate.
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
import { SearchIndex } from '../../enums/search.enum';
import { getFqnSearchIndexes } from './AlertsUtil';

jest.mock('../SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityTypeSearchIndexMapping: jest.fn().mockReturnValue({
      all: 'all',
      table: 'table_search_index',
      topic: 'topic_search_index',
      databaseService: 'database_service_search_index',
      messagingService: 'messaging_service_search_index',
    }),
  },
}));

describe('getFqnSearchIndexes with several sources', () => {
  it('searches every selected source and every container, each once', () => {
    expect(
      getFqnSearchIndexes(
        ['table', 'topic', 'table'],
        ['databaseService', 'messagingService']
      )
    ).toEqual([
      'table_search_index',
      'topic_search_index',
      'database_service_search_index',
      'messaging_service_search_index',
    ]);
  });

  it('answers one source exactly as before', () => {
    expect(getFqnSearchIndexes('table', ['databaseService'])).toEqual([
      'table_search_index',
      'database_service_search_index',
    ]);
    expect(getFqnSearchIndexes('all', ['databaseService'])).toEqual([
      SearchIndex.ALL,
    ]);
  });
});
