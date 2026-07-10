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
import { render, screen } from '@testing-library/react';
import { DqDashboardChartFilters } from './DataQualityDashboard.interface';
import { DqDashboardSectionContent } from './DqDashboardSectionContent.component';

jest.mock('@openmetadata/ui-core-components', () => {
  const Grid = ({ children }: React.PropsWithChildren) => (
    <div data-testid="grid">{children}</div>
  );
  Grid.Item = ({
    children,
    span,
  }: React.PropsWithChildren<{ span?: number }>) => (
    <div data-span={span} data-testid="grid-item">
      {children}
    </div>
  );

  return { Grid };
});

jest.mock('../../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: {
    getDataQualityPagePath: jest
      .fn()
      .mockImplementation((tab: string) => `/data-quality/${tab}`),
    getIncidentManagerPath: jest
      .fn()
      .mockImplementation(() => '/incident-manager'),
  },
}));

jest.mock(
  '../ChartWidgets/DataAssetsCoveragePieChartWidget/DataAssetsCoveragePieChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="data-assets-coverage-widget" />
      ))
);

jest.mock(
  '../ChartWidgets/EntityHealthStatusPieChartWidget/EntityHealthStatusPieChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => <div data-testid="entity-health-widget" />)
);

jest.mock(
  '../ChartWidgets/IncidentTimeChartWidget/IncidentTimeChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(({ name }: { name: string }) => (
        <div data-testid={`incident-time-widget-${name}`} />
      ))
);

jest.mock(
  '../ChartWidgets/IncidentTypeAreaChartWidget/IncidentTypeAreaChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(({ name }: { name: string }) => (
        <div data-testid={`incident-type-widget-${name}`} />
      ))
);

jest.mock(
  '../ChartWidgets/StatusByDimensionCardWidget/StatusByDimensionCardWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="status-by-dimension-widget" />
      ))
);

jest.mock(
  '../ChartWidgets/TestCaseStatusAreaChartWidget/TestCaseStatusAreaChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(({ name }: { name: string }) => (
        <div data-testid={`test-case-status-area-widget-${name}`} />
      ))
);

jest.mock(
  '../ChartWidgets/TestCaseStatusPieChartWidget/TestCaseStatusPieChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="test-case-status-pie-widget" />
      ))
);

const pieChartFilters: DqDashboardChartFilters = {
  ownerFqn: 'admin',
};

const defaultFilters: DqDashboardChartFilters = {
  startTs: 1000,
  endTs: 2000,
};

const renderSection = (sectionKey: string) =>
  render(
    <DqDashboardSectionContent
      defaultFilters={defaultFilters}
      pieChartFilters={pieChartFilters}
      sectionKey={sectionKey as never}
    />
  );

describe('DqDashboardSectionContent component', () => {
  it('should render the data-health section with three pie chart widgets', () => {
    renderSection('data-health');

    expect(
      screen.getByTestId('data-assets-coverage-widget')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-health-widget')).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-status-pie-widget')
    ).toBeInTheDocument();
  });

  it('should render the data-dimensions section with the dimension card widget', () => {
    renderSection('data-dimensions');

    expect(
      screen.getByTestId('status-by-dimension-widget')
    ).toBeInTheDocument();
  });

  it('should render the test-case-status section with success/aborted/failed area widgets', () => {
    renderSection('test-case-status');

    expect(
      screen.getByTestId('test-case-status-area-widget-success')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-status-area-widget-aborted')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-status-area-widget-failed')
    ).toBeInTheDocument();
  });

  it('should render the incident-metrics section with incident type and time widgets', () => {
    renderSection('incident-metrics');

    expect(
      screen.getByTestId('incident-type-widget-open-incident')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-type-widget-resolved-incident')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-time-widget-response-time')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-time-widget-resolution-time')
    ).toBeInTheDocument();
  });

  it('should render nothing for an unknown section key', () => {
    const { container } = renderSection('unknown-section');

    expect(container).toBeEmptyDOMElement();
  });
});
