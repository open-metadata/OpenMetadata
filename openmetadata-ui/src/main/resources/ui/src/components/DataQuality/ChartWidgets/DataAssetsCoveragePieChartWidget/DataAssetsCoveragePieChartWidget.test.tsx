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
import { act, render, screen } from '@testing-library/react';
import {
  fetchEntityCoveredWithDQ,
  fetchTotalEntityCount,
} from '../../../../rest/dataQualityDashboardAPI';
import DataAssetsCoveragePieChartWidget from './DataAssetsCoveragePieChartWidget.component';

jest.mock('../../../../rest/dataQualityDashboardAPI', () => {
  return {
    fetchEntityCoveredWithDQ: jest.fn().mockResolvedValue({ data: [] }),
    fetchTotalEntityCount: jest.fn().mockResolvedValue({ data: [] }),
  };
});
jest.mock('../../../Visualisations/Chart/CustomPieChart.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>CustomPieChart.component</div>);
});

describe('DataAssetsCoveragePieChartWidget', () => {
  it('should render the component', async () => {
    render(<DataAssetsCoveragePieChartWidget />);

    expect(
      await screen.findByText('label.data-asset-plural-coverage')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('CustomPieChart.component')
    ).toBeInTheDocument();
  });

  it('fetchEntityCoveredWithDQ & fetchTotalEntityCount should be called', async () => {
    await act(async () => {
      await render(<DataAssetsCoveragePieChartWidget />);
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledTimes(1);
    expect(fetchTotalEntityCount).toHaveBeenCalledTimes(1);
  });

  it('fetchEntityCoveredWithDQ & fetchTotalEntityCount should be called with filter if provided via props', async () => {
    const filters = {
      tier: ['tier'],
      tags: ['tag1', 'tag2'],
      ownerFqn: 'ownerFqn',
    };
    await act(async () => {
      await render(<DataAssetsCoveragePieChartWidget chartFilter={filters} />);
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(filters, false);
    expect(fetchTotalEntityCount).toHaveBeenCalledWith(filters);
  });
});
