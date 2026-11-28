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

import { act, renderHook } from '@testing-library/react';
import APIClient from '../../../rest/axiosClient';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useMarketplaceEntitySearch } from './useMarketplaceEntitySearch';

jest.mock('../../../rest/axiosClient', () => ({ get: jest.fn() }));
jest.mock('../../../hooks/useSearchStore', () => ({
  useSearchStore: {
    getState: () => ({ isNLPEnabled: true, isNLPActive: true }),
  },
}));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const completeResponse = {
  hits: { hits: [], total: { value: 0, relation: 'eq' } },
  timed_out: false,
  _shards: { failed: 0 },
};

describe('Marketplace NLQ failures', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    { timed_out: true },
    { partial_results: true },
    { _shards: { failed: 1 } },
  ])(
    'shows a failure for incomplete HTTP 200 results: %j',
    async (diagnostics) => {
      (APIClient.get as jest.Mock).mockResolvedValue({
        data: { ...completeResponse, ...diagnostics },
      });
      const { result } = renderHook(useMarketplaceEntitySearch);

      await act(async () => result.current.search('sales data'));

      expect(APIClient.get).toHaveBeenCalledTimes(1);
      expect(showErrorToast).toHaveBeenCalledTimes(1);
      expect(result.current.isSearching).toBe(false);
      expect(result.current.dataProducts).toEqual([]);
    }
  );

  it('does not show an error for a complete empty search', async () => {
    (APIClient.get as jest.Mock).mockResolvedValue({ data: completeResponse });
    const { result } = renderHook(useMarketplaceEntitySearch);

    await act(async () => result.current.search('no matching data'));

    expect(showErrorToast).not.toHaveBeenCalled();
    expect(result.current.isSearching).toBe(false);
  });

  it('ignores a failed request superseded by a newer query', async () => {
    let rejectOld!: (reason: Error) => void;
    (APIClient.get as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          })
      )
      .mockResolvedValueOnce({ data: completeResponse });
    const { result } = renderHook(useMarketplaceEntitySearch);
    let oldRequest!: Promise<void>;
    act(() => {
      oldRequest = result.current.search('old query');
    });
    await act(async () => result.current.search('new query'));
    await act(async () => {
      rejectOld(new Error('old failure'));
      await oldRequest;
    });

    expect(showErrorToast).not.toHaveBeenCalled();
    expect(result.current.isSearching).toBe(false);
  });
});
