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
import {
  ChartSeries,
  ChartTooltipItem,
  LineChart,
} from '@openmetadata/ui-core-components/charts';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import { KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { KPI_LIST } from '../../pages/KPIPage/KPIMock.mock';
import KPIChart from './KPIChart';

jest.mock('../../rest/KpiAPI', () => ({
  getListKPIs: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: KPI_LIST })),
  getListKpiResult: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ results: [{ day: 1, count: 40 }] })
    ),
}));

jest.mock('./EmptyGraphPlaceholder', () => ({
  EmptyGraphPlaceholder: jest
    .fn()
    .mockReturnValue(<div data-testid="empty-graph-placeholder" />),
}));

const NUMBER_KPI = {
  ...KPI_LIST[0],
  id: 'number-kpi-id',
  name: 'number-kpi',
  displayName: 'Number KPI',
  fullyQualifiedName: 'number-kpi',
  metricType: KpiTargetType.Number,
};

const lastLineProps = () =>
  (LineChart as unknown as jest.Mock).mock.calls.at(-1)[0];

describe('Test KPIChart Component', () => {
  const mockProps = {
    chartFilter: {
      startTs: 1234567890,
      endTs: 1234567899,
    },
    kpiList: KPI_LIST,
    isKpiLoading: false,
    viewKPIPermission: true,
    createKPIPermission: true,
  };

  it('Should render KPIChart component', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const kpiCard = screen.getByTestId('kpi-card');

    expect(kpiCard).toBeInTheDocument();
  });

  it('Should render EmptyGraphPlaceholder when no data is available', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} kpiList={[]} />, {
        wrapper: MemoryRouter,
      });
    });

    const emptyPlaceholder = screen.getByText(
      'message.no-kpi-available-add-new-one'
    );

    expect(emptyPlaceholder).toBeInTheDocument();
  });

  it('Should render "Add KPI" button when no KPIs exist and user has create permission', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} kpiList={[]} />, {
        wrapper: MemoryRouter,
      });
    });

    const addButton = screen.getByText('label.add-entity');

    expect(addButton).toBeInTheDocument();
  });

  it('Should not render "Add KPI" button when no create permission', async () => {
    await act(async () => {
      render(
        <KPIChart {...mockProps} createKPIPermission={false} kpiList={[]} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const addButton = screen.queryByText('label.add-entity');

    expect(addButton).not.toBeInTheDocument();
  });

  it('plots every KPI on one day axis with the native legend', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} />, { wrapper: MemoryRouter });
    });

    const props = lastLineProps();

    expect(props.xKey).toBe('day');
    expect(props.series.map((s: ChartSeries) => s.key)).toEqual(
      KPI_LIST.map((k) => k.name)
    );
    expect(props.series[0].seriesOption).toEqual({
      connectNulls: true,
      emphasis: { focus: 'series' },
    });
    expect(props.legend).toBeUndefined();
  });

  it('formats percentage KPIs with % and number KPIs without', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} kpiList={[...KPI_LIST, NUMBER_KPI]} />, {
        wrapper: MemoryRouter,
      });
    });
    const { tooltip } = lastLineProps();
    const items = [KPI_LIST[0].name, NUMBER_KPI.name].map(
      (name) =>
        ({
          seriesKey: name,
          name,
          value: 40,
          color: '#100000',
        } as ChartTooltipItem)
    );

    render(<>{tooltip.render(items, { day: 1 })}</>);

    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('shows the latest results that come with the KPI list', async () => {
    const kpiWithResult = {
      ...KPI_LIST[0],
      kpiResult: {
        kpiFqn: KPI_LIST[0].fullyQualifiedName,
        timestamp: 1,
        targetResult: [{ name: 'fraction', value: '40', targetMet: false }],
      },
    };

    await act(async () => {
      render(<KPIChart {...mockProps} kpiList={[kpiWithResult]} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      screen.getByTestId('kpi-latest-result-container')
    ).toBeInTheDocument();
  });
});
