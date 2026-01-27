/*
 *  Copyright 2023 Collate.
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
import { queryByAttribute, render, screen } from '@testing-library/react';
import '../../../../../test/unit/mocks/mui.mock';
import { useTableProfiler } from '../TableProfilerProvider';
import CustomMetricGraphs from './CustomMetricGraphs.component';

const mockProps = {
  customMetricsGraphData: {
    CountOfFRAddress: [
      {
        CountOfFRAddress: 1387,
        formattedTimestamp: 'Dec 03, 11:54',
        timestamp: 1701584699297,
      },
      {
        CountOfFRAddress: 1402,
        formattedTimestamp: 'Dec 03, 11:55',
        timestamp: 1701584730652,
      },
    ],
    CountOfUSAddress: [],
  },
  isLoading: false,
  customMetrics: [
    {
      id: 'id1',
      name: 'CountOfFRAddress',
      expression:
        "SELECT COUNT(address_id) FROM dim_address WHERE country = 'FR'",
      updatedAt: 1701757494892,
      updatedBy: 'admin',
    },
    {
      id: 'id2',
      name: 'CountOfUSAddress',
      expression:
        "SELECT COUNT(address_id) FROM dim_address WHERE country = 'US'",
      updatedAt: 1701757494868,
      updatedBy: 'admin',
    },
  ],
};
jest.mock('../../../../../utils/DataInsightUtils', () => {
  return jest.fn().mockImplementation(() => {
    return <div>CustomTooltip</div>;
  });
});
jest.mock(
  '../../../../DataQuality/CustomMetricForm/CustomMetricForm.component',
  () => {
    return jest.fn().mockImplementation(() => <div>CustomMetricForm</div>);
  }
);
jest.mock('../../../Profiler/ProfilerLatestValue/ProfilerLatestValue', () => {
  return jest.fn().mockImplementation(() => <div>ProfilerLatestValue</div>);
});
jest.mock('../../../../common/DeleteWidget/DeleteWidgetModal', () => {
  return jest.fn().mockImplementation(() => <div>DeleteWidgetModal</div>);
});
jest.mock('../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>);
});
jest.mock('../TableProfilerProvider', () => {
  return {
    useTableProfiler: jest.fn().mockImplementation(() => ({
      permissions: { EditAll: true, Delete: true },
      onCustomMetricUpdate: jest.fn(),
    })),
  };
});

describe('CustomMetricGraphs', () => {
  it('should render component', async () => {
    render(<CustomMetricGraphs {...mockProps} />);
    const metric1 = mockProps.customMetrics[0].name;
    const metric2 = mockProps.customMetrics[1].name;

    expect(
      await screen.findByTestId('custom-metric-graph-container')
    ).toBeInTheDocument();
    expect(await screen.findByText(metric1)).toBeInTheDocument();
    expect(await screen.findByText(metric2)).toBeInTheDocument();
    expect(await screen.findAllByText(`ProfilerLatestValue`)).toHaveLength(2);
    expect(
      await screen.findAllByTestId('profiler-details-card-container')
    ).toHaveLength(2);
  });

  it('graph should visible when data is present', async () => {
    const { container } = render(<CustomMetricGraphs {...mockProps} />);
    const name = mockProps.customMetrics[0].name;
    const graph = queryByAttribute('id', container, `${name}-graph`);

    expect(graph).toBeInTheDocument();
  });

  it('should render no data placeholder, when there is no data', async () => {
    render(<CustomMetricGraphs {...mockProps} />);
    const errorPlaceHolder = await screen.findByText('ErrorPlaceHolder');

    expect(errorPlaceHolder).toBeInTheDocument();
  });

  it('should not render menu icon if there is no permission', async () => {
    (useTableProfiler as jest.Mock).mockImplementationOnce(() => ({
      permissions: { EditAll: false, Delete: false },
    }));
    render(<CustomMetricGraphs {...mockProps} />);
    const name = mockProps.customMetrics[1].name;

    expect(await screen.findByText(name)).toBeInTheDocument();
  });

  it('Edit action', async () => {
    render(<CustomMetricGraphs {...mockProps} />);

    expect(
      await screen.findByTestId('custom-metric-graph-container')
    ).toBeInTheDocument();
  });

  it('Delete action', async () => {
    render(<CustomMetricGraphs {...mockProps} />);

    expect(
      await screen.findByTestId('custom-metric-graph-container')
    ).toBeInTheDocument();
  });

  it("CustomMetric should be visible based on 'customMetrics' prop", async () => {
    render(
      <CustomMetricGraphs
        {...mockProps}
        customMetrics={[mockProps.customMetrics[0]]}
      />
    );
    const name = mockProps.customMetrics[0].name;
    const name2 = mockProps.customMetrics[1].name;

    expect(await screen.findByText(name)).toBeInTheDocument();
    expect(screen.queryByText(name2)).not.toBeInTheDocument();
  });
});
