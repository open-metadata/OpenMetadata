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
import { fetchEntityCoveredWithDQ } from '../../../../rest/dataQualityDashboardAPI';
import EntityHealthStatusPieChartWidget from './EntityHealthStatusPieChartWidget.component';

jest.mock('../../../../rest/dataQualityDashboardAPI', () => {
  return {
    fetchEntityCoveredWithDQ: jest.fn().mockResolvedValue({ data: [] }),
  };
});
jest.mock('../../../Visualisations/Chart/CustomPieChart.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>CustomPieChart.component</div>);
});

describe('EntityHealthStatusPieChartWidget', () => {
  it('should render the component', async () => {
    render(<EntityHealthStatusPieChartWidget />);

    expect(
      await screen.findByText('label.healthy-data-asset-plural')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('CustomPieChart.component')
    ).toBeInTheDocument();
  });

  it('fetchEntityCoveredWithDQ should be called', async () => {
    await act(async () => {
      await render(<EntityHealthStatusPieChartWidget />);
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledTimes(2);
  });

  it('fetchEntityCoveredWithDQ should be called with filter if provided via props', async () => {
    const filters = {
      tier: ['tier'],
      tags: ['tag1', 'tag2'],
      ownerFqn: 'ownerFqn',
    };
    await act(async () => {
      await render(<EntityHealthStatusPieChartWidget chartFilter={filters} />);
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(filters, true);
    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(filters, false);
  });
});
