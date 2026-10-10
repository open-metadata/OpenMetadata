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
import { getTermQuery } from '../SearchPureUtils';
import { getAlertSourceSearch } from './AlertSourceSearch';

const mockSearchQuery = jest.fn();
const mockSearchContracts = jest.fn();
jest.mock('../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));
jest.mock('../../rest/contractAPI', () => ({
  searchContracts: (...args: unknown[]) => mockSearchContracts(...args),
}));

describe('alert source searches', () => {
  beforeEach(() => {
    mockSearchQuery.mockReset();
    mockSearchContracts.mockReset();
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'table-id',
              fullyQualifiedName: 'svc.db.schema.table',
              entityType: 'table',
            },
          },
        ],
      },
    });
    mockSearchContracts.mockResolvedValue([
      { fullyQualifiedName: 'svc.db.schema.table.contract' },
    ]);
  });

  it('combines contract API matches and selected source indexes', async () => {
    const search = getAlertSourceSearch(['table', 'dataContract']);

    expect(await search.byName('needle')).toEqual([
      {
        label: 'svc.db.schema.table.contract',
        value: 'svc.db.schema.table.contract',
      },
      { label: 'svc.db.schema.table', value: 'svc.db.schema.table' },
    ]);
    expect(mockSearchContracts).toHaveBeenCalledWith('needle', 50);
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'needle',
        searchIndex: [SearchIndex.TABLE],
      })
    );
  });

  it('searches contract names without requesting a search index', async () => {
    expect(
      await getAlertSourceSearch(['dataContract']).byName('contract')
    ).toEqual([
      {
        label: 'svc.db.schema.table.contract',
        value: 'svc.db.schema.table.contract',
      },
    ]);
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('resolves IDs across every selected source and applies an exact UUID filter', async () => {
    const id = 'f4636187-553a-44af-9994-99681a921670';
    const search = getAlertSourceSearch(['table', 'topic']);

    expect(await search.byId(' ' + id + ' ')).toEqual([
      { id: 'table-id', fullyQualifiedName: 'svc.db.schema.table' },
    ]);
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: id,
        queryFilter: getTermQuery({ id }),
        searchIndex: [SearchIndex.TABLE, SearchIndex.TOPIC],
      })
    );
  });

  it('adds wildcard container matches without altering leaf values', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          { _source: { fullyQualifiedName: 'svc.db', entityType: 'database' } },
          {
            _source: {
              fullyQualifiedName: 'svc.db.schema.table',
              entityType: 'table',
            },
          },
        ],
      },
    });

    expect(
      await getAlertSourceSearch(['table'], ['database']).byName('svc')
    ).toEqual([
      { label: 'svc.db.*', value: 'svc.db' },
      { label: 'svc.db.schema.table', value: 'svc.db.schema.table' },
    ]);
  });
});
