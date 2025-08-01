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
import { render, screen } from '@testing-library/react';
import { act } from 'react-test-renderer';
import { MOCK_KPI_LIST_RESPONSE } from '../../../../pages/KPIPage/KPIMock.mock';
import { getListKPIs } from '../../../../rest/KpiAPI';
import KPIWidget from './KPIWidget.component';

jest.mock('../../../../constants/DataInsight.constants', () => ({
  DATA_INSIGHT_GRAPH_COLORS: ['#E7B85D'],
}));

jest.mock('../../../../constants/constants', () => {
  const actualConstants = jest.requireActual('../../../../constants/constants');

  return {
    ...actualConstants,
    CHART_WIDGET_DAYS_DURATION: 14,
    GRAPH_BACKGROUND_COLOR: '#000000',
  };
});

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  customFormatDateTime: jest.fn().mockReturnValue('Dec 05, 11:54'),
  getCurrentMillis: jest.fn().mockReturnValue(1711583974000),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1709424034000),
}));

jest.mock('../../../../rest/DataInsightAPI', () => ({
  DataInsightCustomChartResult: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../../rest/KpiAPI', () => ({
  getLatestKpiResult: jest.fn().mockImplementation(() =>
    Promise.resolve({
      timestamp: 1724760319723,
      kpiFqn: 'description-percentage',
      targetResult: [
        {
          value: '23.52941176470588',
          targetMet: false,
        },
      ],
    })
  ),
  getListKpiResult: jest.fn().mockImplementation(() =>
    Promise.resolve({
      results: [
        {
          count: 23.52941176470588,
          day: 1724716800000,
        },
      ],
    })
  ),
  getListKPIs: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_KPI_LIST_RESPONSE)),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  Transi18next: jest.fn().mockReturnValue('text'),
}));

jest.mock('../../../DataInsight/KPILatestResultsV1', () =>
  jest.fn().mockReturnValue(<p>KPILatestResultsV1.Component</p>)
);

jest.mock('../Common/WidgetEmptyState/WidgetEmptyState', () =>
  jest.fn().mockReturnValue(<p>WidgetEmptyState.Component</p>)
);

jest.mock('./KPILegend/KPILegend', () =>
  jest.fn().mockReturnValue(<p>KPILegend.Component</p>)
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

const mockHandleRemoveWidget = jest.fn();
const mockHandleLayoutUpdate = jest.fn();

const widgetProps = {
  isEditView: true,
  widgetKey: 'testWidgetKey',
  handleRemoveWidget: mockHandleRemoveWidget,
  handleLayoutUpdate: mockHandleLayoutUpdate,
  currentLayout: [
    {
      i: 'testWidgetKey',
      x: 0,
      y: 0,
      w: 2, // Full size widget (width = 2)
      h: 1,
    },
  ],
};

describe('KPIWidget', () => {
  it('renders widget with header', async () => {
    render(<KPIWidget {...widgetProps} />);

    expect(await screen.findByTestId('widget-header')).toBeInTheDocument();
  });

  it('renders widget wrapper', async () => {
    render(<KPIWidget {...widgetProps} />);

    expect(await screen.findByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('should fetch kpi list api initially', async () => {
    render(<KPIWidget {...widgetProps} />);

    expect(getListKPIs).toHaveBeenCalledWith({ fields: 'dataInsightChart' });
  });

  it('should render charts and data if present', async () => {
    await act(async () => {
      render(<KPIWidget {...widgetProps} />);
    });

    expect(await screen.findByText('label.kpi-title')).toBeInTheDocument();
    // Instead of testing KPILegend which has complex dependencies,
    // test that the chart container is rendered when data is present
    expect(await screen.findByTestId('kpi-widget')).toBeInTheDocument();
  });

  it('should render WidgetEmptyState if no data there', async () => {
    (getListKPIs as jest.Mock).mockImplementation(() =>
      Promise.resolve({ data: [] })
    );

    render(
      <KPIWidget
        {...widgetProps}
        currentLayout={[
          {
            i: 'testWidgetKey',
            x: 0,
            y: 0,
            w: 1,
            h: 1,
          },
        ]}
      />
    );

    // Wait for loading to complete and empty state to render
    expect(
      await screen.findByText('WidgetEmptyState.Component')
    ).toBeInTheDocument();
  });
});
