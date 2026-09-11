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
import '@testing-library/jest-dom/extend-expect';
import { act, render, screen, waitFor } from '@testing-library/react';
import { fetchIncidentTimeMetrics } from '../../../../rest/dataQualityDashboardAPI';
import {
  IncidentTimeChartWidgetProps,
  IncidentTimeMetricsType,
} from '../../DataQuality.interface';
import IncidentTimeChartWidget from './IncidentTimeChartWidget.component';

jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchIncidentTimeMetrics: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [
        {
          'metrics.value': '5549.916666666667',
          'metrics.name.keyword': 'timeToResponse',
          timestamp: '1729468800000',
        },
        {
          'metrics.value': null,
          'metrics.name.keyword': 'timeToResponse',
          timestamp: '1729468800000',
        },
      ],
    })
  ),
}));
jest.mock('../../../../utils/date-time/DateTimeUtils', () => {
  return {
    convertMillisecondsToHumanReadableFormat: jest
      .fn()
      .mockReturnValue('1h 32m'),
  };
});
jest.mock('../../../Visualisations/Chart/CustomAreaChart.component', () =>
  jest.fn().mockImplementation(() => <div>CustomAreaChart.component</div>)
);

const defaultProps: IncidentTimeChartWidgetProps = {
  incidentMetricType: IncidentTimeMetricsType.TIME_TO_RESOLUTION,
  name: 'Incident Type',
  title: 'Incident time Area Chart Widget',
};

describe('IncidentTimeChartWidget', () => {
  it('should render the component', async () => {
    render(<IncidentTimeChartWidget {...defaultProps} />);

    expect(await screen.findByText(defaultProps.title)).toBeInTheDocument();
    expect(
      await screen.findByText('CustomAreaChart.component')
    ).toBeInTheDocument();
    expect((await screen.findByTestId('average-time')).textContent).toEqual(
      '1h 32m'
    );
  });

  it('should call fetchIncidentTimeMetrics function', async () => {
    render(<IncidentTimeChartWidget {...defaultProps} />);

    expect(fetchIncidentTimeMetrics).toHaveBeenCalledWith(
      defaultProps.incidentMetricType,
      undefined
    );
  });

  it('should call fetchIncidentTimeMetrics with filters provided via props', async () => {
    const filters = {
      endTs: 1625097600000,
      startTs: 1625097600000,
      ownerFqn: 'ownerFqn',
      tags: ['tag1', 'tag2'],
      tier: ['tier1'],
    };
    const status = IncidentTimeMetricsType.TIME_TO_RESPONSE;
    render(
      <IncidentTimeChartWidget
        {...defaultProps}
        chartFilter={filters}
        incidentMetricType={status}
      />
    );

    expect(fetchIncidentTimeMetrics).toHaveBeenCalledWith(status, filters);
  });

  it('should handle API errors gracefully', async () => {
    (fetchIncidentTimeMetrics as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );
    render(<IncidentTimeChartWidget {...defaultProps} />);
    await waitFor(() => expect(fetchIncidentTimeMetrics).toHaveBeenCalled());

    expect(await screen.findByText(defaultProps.title)).toBeInTheDocument();
    expect(
      await screen.findByText('CustomAreaChart.component')
    ).toBeInTheDocument();
    expect((await screen.findByTestId('average-time')).textContent).toEqual(
      '--'
    );
  });

  it('should keep the latest chartFilter data when a stale request resolves last', async () => {
    const release: Record<number, () => void> = {};
    const gates: Record<number, Promise<void>> = {
      1: new Promise((resolve) => {
        release[1] = resolve;
      }),
      100: new Promise((resolve) => {
        release[100] = resolve;
      }),
    }; // The stale filter has no metric value, so applying it would render '--'.
    (fetchIncidentTimeMetrics as jest.Mock).mockImplementation(
      async (_type: IncidentTimeMetricsType, filters: { startTs: number }) => {
        await gates[filters.startTs];

        return {
          data: [
            {
              'metrics.value':
                filters.startTs === 100 ? '5549.916666666667' : null,
              'metrics.name.keyword': 'timeToResponse',
              timestamp: '1729468800000',
            },
          ],
        };
      }
    );

    const { rerender } = render(
      <IncidentTimeChartWidget
        {...defaultProps}
        chartFilter={{ startTs: 1, endTs: 10 }}
      />
    );
    rerender(
      <IncidentTimeChartWidget
        {...defaultProps}
        chartFilter={{ startTs: 100, endTs: 200 }}
      />
    );

    await act(async () => release[100]());
    await act(async () => release[1]());

    expect(screen.getByTestId('average-time')).toHaveTextContent('1h 32m');
  });
});
