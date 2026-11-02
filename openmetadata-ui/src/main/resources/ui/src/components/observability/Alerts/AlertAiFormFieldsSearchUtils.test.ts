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
import { searchQuery } from '../../../rest/searchAPI';
import {
  AlertSourceSearch,
  getAlertSourceSearch,
} from '../../../utils/Alerts/AlertSourceSearch';
import { searchAlertAiArgumentOptions } from './AlertAiFormFieldsSearchUtils';

const mockSearchContracts = jest.fn();

jest.mock('../../../rest/contractAPI', () => ({
  searchContracts: (...args: unknown[]) => mockSearchContracts(...args),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const sourceSearchOf = (
  found: Partial<AlertSourceSearch> = {}
): AlertSourceSearch => ({
  indexes: [],
  containerEntities: [],
  byName: jest.fn().mockResolvedValue([]),
  byId: jest.fn().mockResolvedValue([]),
  ...found,
});

describe('searchAlertAiArgumentOptions', () => {
  it('finds names through the search of every chosen source', async () => {
    const byName = jest.fn().mockResolvedValue([
      { label: 'shop.orders', value: 'shop.orders' },
      { label: 'sales.revenue', value: 'sales.revenue' },
    ]);

    await expect(
      searchAlertAiArgumentOptions({
        argument: 'fqnList',
        searchText: ' or ',
        sourceSearch: sourceSearchOf({ byName }),
      })
    ).resolves.toEqual([
      { id: 'shop.orders', label: 'shop.orders' },
      { id: 'sales.revenue', label: 'sales.revenue' },
    ]);
    expect(byName).toHaveBeenCalledWith('or');
  });

  it('finds ids through the search of every chosen source', async () => {
    const byId = jest
      .fn()
      .mockResolvedValue([{ id: 'id-1', fullyQualifiedName: 'shop.orders' }]);

    await expect(
      searchAlertAiArgumentOptions({
        argument: 'entityIdList',
        searchText: 'id',
        sourceSearch: sourceSearchOf({ byId }),
      })
    ).resolves.toEqual([
      { id: 'id-1', label: 'id-1', supportingText: 'shop.orders' },
    ]);
  });

  it('lists data contracts for the FQN filter of a data contract source', async () => {
    mockSearchContracts.mockResolvedValue([
      { fullyQualifiedName: 'db.schema.orders.contract' },
      { fullyQualifiedName: undefined },
    ]);

    await expect(
      searchAlertAiArgumentOptions({
        argument: 'fqnList',
        searchText: ' orders ',
        sourceSearch: getAlertSourceSearch(['dataContract']),
      })
    ).resolves.toEqual([
      {
        id: 'db.schema.orders.contract',
        label: 'db.schema.orders.contract',
      },
    ]);

    expect(mockSearchContracts).toHaveBeenCalledWith('orders', 50);
  });

  it('searches the index an argument always searches, whatever the sources', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [{ _source: { fullyQualifiedName: 'finance', name: 'finance' } }],
      },
    });

    await expect(
      searchAlertAiArgumentOptions({
        argument: 'domainList',
        searchText: 'fin',
        sourceSearch: sourceSearchOf(),
      })
    ).resolves.toEqual([{ id: 'finance', label: 'finance' }]);
    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'fin', searchIndex: SearchIndex.DOMAIN })
    );
  });

  it('offers nothing for an argument it does not search, and nothing when a search fails', async () => {
    const byName = jest.fn().mockRejectedValue(new Error('down'));

    await expect(
      searchAlertAiArgumentOptions({
        argument: 'pipelineStateList',
        searchText: '',
        sourceSearch: sourceSearchOf(),
      })
    ).resolves.toEqual([]);
    await expect(
      searchAlertAiArgumentOptions({
        argument: 'fqnList',
        searchText: '',
        sourceSearch: sourceSearchOf({ byName }),
      })
    ).resolves.toEqual([]);
  });
});
