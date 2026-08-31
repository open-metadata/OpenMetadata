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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import {
  addMetricTabAssets,
  getMetricTabAssets,
} from '../../../rest/metricTabsAPI';
import { searchQuery } from '../../../rest/searchAPI';
import MetricAssetAddDialog, {
  METRIC_ASSET_DETAIL_SEARCH_INDEXES,
  METRIC_ASSET_SEARCH_INDEXES,
} from './MetricAssetAddDialog';

jest.mock('../../../rest/metricTabsAPI', () => ({
  addMetricTabAssets: jest.fn(),
  getMetricTabAssets: jest.fn(),
}));
jest.mock('../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('MetricAssetAddDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMetricTabAssets as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  it('offers API Collections alongside API Endpoints', () => {
    expect(METRIC_ASSET_SEARCH_INDEXES).toEqual(
      expect.arrayContaining([
        SearchIndex.API_COLLECTION,
        SearchIndex.API_ENDPOINT,
      ])
    );
  });

  it('backs All with only asset types that have a full detail summary', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    });

    render(
      <MetricAssetAddDialog
        open
        existingAssetIds={new Set()}
        metricFqn="revenue"
        metricId="metric-1"
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
      { wrapper }
    );

    await waitFor(() => expect(searchQuery).toHaveBeenCalled());

    expect(METRIC_ASSET_SEARCH_INDEXES).toContain(SearchIndex.DATA_ASSET);
    expect(METRIC_ASSET_DETAIL_SEARCH_INDEXES).toEqual([
      SearchIndex.TABLE,
      SearchIndex.TOPIC,
      SearchIndex.DASHBOARD,
      SearchIndex.PIPELINE,
      SearchIndex.MLMODEL,
      SearchIndex.CONTAINER,
      SearchIndex.SEARCH_INDEX,
      SearchIndex.STORED_PROCEDURE,
      SearchIndex.API_COLLECTION,
      SearchIndex.API_ENDPOINT,
    ]);
    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: METRIC_ASSET_DETAIL_SEARCH_INDEXES,
      })
    );
  });

  it('marks current-page existing assets and adds a newly selected search result', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'existing',
            _source: {
              entityType: 'table',
              fullyQualifiedName: 'service.existing',
              name: 'existing_orders',
            },
          },
          {
            _id: 'new',
            _source: {
              entityType: 'table',
              fullyQualifiedName: 'service.new',
              name: 'new_orders',
            },
          },
        ],
        total: { value: 2 },
      },
    });
    (addMetricTabAssets as jest.Mock).mockResolvedValue({
      numberOfRowsFailed: 0,
      numberOfRowsPassed: 1,
    });
    const onComplete = jest.fn();
    render(
      <MetricAssetAddDialog
        open
        existingAssetIds={new Set(['existing'])}
        metricFqn="revenue"
        metricId="metric-1"
        onClose={jest.fn()}
        onComplete={onComplete}
      />,
      { wrapper }
    );

    const existing = await screen.findByRole('checkbox', {
      name: 'existing_orders',
    });

    expect(existing).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'new_orders' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'new_orders' })).toBeChecked()
    );
    fireEvent.click(screen.getByTestId('metric-asset-add-confirm'));

    await waitFor(() => expect(addMetricTabAssets).toHaveBeenCalled());

    expect(addMetricTabAssets).toHaveBeenCalledWith('revenue', [
      expect.objectContaining({ id: 'new', type: 'table' }),
    ]);
    expect(onComplete).toHaveBeenCalled();
  });

  it('checks the server before selecting an asset linked on another page', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'linked-elsewhere',
            _source: {
              entityType: 'table',
              fullyQualifiedName: 'service.linked_elsewhere',
              name: 'linked_elsewhere',
            },
          },
        ],
        total: { value: 1 },
      },
    });
    (getMetricTabAssets as jest.Mock).mockResolvedValue({
      data: [
        {
          asset: { id: 'linked-elsewhere', type: 'table' },
          direction: 'upstream',
        },
      ],
      paging: { total: 1 },
    });
    render(
      <MetricAssetAddDialog
        open
        existingAssetIds={new Set()}
        metricFqn="revenue"
        metricId="metric-1"
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
      { wrapper }
    );

    const checkbox = await screen.findByRole('checkbox', {
      name: 'linked_elsewhere',
    });
    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).toBeDisabled());

    expect(getMetricTabAssets).toHaveBeenCalledWith('metric-1', {
      limit: 10,
      offset: 0,
      q: 'service.linked_elsewhere',
    });
    expect(screen.getByText('label.added')).toBeVisible();
    expect(addMetricTabAssets).not.toHaveBeenCalled();
  });
});
