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
import { act, render } from '@testing-library/react';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import { getChartPreviewByName } from '../../../rest/DataInsightAPI';
import { DataInsightChartCard } from '../DataInsightChartCard';
import DataAssetsTab from './DataAssetsTab.component';

const mockTotalAssets = { results: [{ day: 1, group: 'table', count: 9 }] };

const mockProvider = {
  chartFilter: { startTs: 1, endTs: 2 },
  kpi: { isLoading: false, data: [] },
};

jest.mock('../../../pages/DataInsightPage/DataInsightProvider', () => ({
  useDataInsightProvider: jest.fn().mockImplementation(() => mockProvider),
}));

jest.mock('../../../rest/DataInsightAPI', () => ({
  getChartPreviewByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTotalAssets)),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../DataInsightChartCard', () => ({
  DataInsightChartCard: jest.fn().mockReturnValue(null),
}));

const renderTab = () =>
  act(async () => {
    render(<DataAssetsTab />);
  });

describe('DataAssetsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider.kpi = { isLoading: false, data: [] };
  });

  it('fetches total data assets once and shares it with the cards', async () => {
    await renderTab();

    expect(getChartPreviewByName).toHaveBeenCalledTimes(1);
    expect(getChartPreviewByName).toHaveBeenCalledWith(
      SystemChartType.TotalDataAssets,
      { start: 1, end: 2, filter: undefined }
    );

    const cardProps = (DataInsightChartCard as jest.Mock).mock.calls
      .slice(-6)
      .map(([props]) => props);

    const sharing = cardProps.filter(
      ({ totalAssets }) => totalAssets === mockTotalAssets
    );

    expect(sharing).toHaveLength(5);
    expect(sharing.map(({ type }) => type)).not.toContain(
      SystemChartType.TotalDataAssetsByTier
    );
  });

  it('hands the cards null when the totals request fails', async () => {
    (getChartPreviewByName as jest.Mock).mockRejectedValueOnce(
      new Error('boom')
    );

    await renderTab();

    const cardProps = (DataInsightChartCard as jest.Mock).mock.calls
      .slice(-6)
      .map(([props]) => props);

    expect(
      cardProps.filter(({ totalAssets }) => totalAssets === null)
    ).toHaveLength(5);
  });

  it('does not fetch while the KPIs are loading', async () => {
    mockProvider.kpi = { isLoading: true, data: [] };

    await renderTab();

    expect(getChartPreviewByName).not.toHaveBeenCalled();
  });
});
