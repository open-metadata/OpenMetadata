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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import DataQualityDashboard from './DataQualityDashboard';

const mockUseDataQualityDashboardFilters = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, className, direction, gap }: any) => (
    <div
      className={className}
      data-direction={direction}
      data-gap={gap}
      data-testid="box">
      {children}
    </div>
  ),
}));

jest.mock(
  'components/DataQuality/DataQualityDashboard/DqDashboardSectionContent.component',
  () => ({
    __esModule: true,
    DQ_DASHBOARD_SECTIONS: [
      {
        key: 'data-health',
        header: { header: 'label.data-health', subHeader: 'sub.data-health' },
      },
      {
        key: 'data-dimensions',
        header: {
          header: 'label.data-dimensions',
          subHeader: 'sub.data-dimensions',
        },
      },
      {
        key: 'test-case-status',
        header: {
          header: 'label.test-case-status',
          subHeader: 'sub.test-case-status',
        },
      },
      {
        key: 'incident-metrics',
        header: {
          header: 'label.incident-metrics',
          subHeader: 'sub.incident-metrics',
        },
      },
    ],
    default: ({
      sectionKey,
      defaultFilters,
      navigate,
      pieChartFilters,
    }: any) => (
      <div
        data-default-filters={JSON.stringify(defaultFilters)}
        data-has-navigate={String(navigate === mockNavigate)}
        data-pie-chart-filters={JSON.stringify(pieChartFilters)}
        data-testid={`section-content-${sectionKey}`}>
        section-{sectionKey}
      </div>
    ),
  })
);

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock(
  'components/DataQuality/DataQualityDashboard/useDataQualityDashboardFilters',
  () => ({
    useDataQualityDashboardFilters: (args: any) =>
      mockUseDataQualityDashboardFilters(args),
  })
);

jest.mock('./DqFilterBar', () => ({
  __esModule: true,
  default: ({
    hasActiveFilters,
    hasVisibleFilters,
    showFilterBar,
    clearAll,
  }: any) => (
    <div
      data-has-active-filters={String(hasActiveFilters)}
      data-has-visible-filters={String(hasVisibleFilters)}
      data-show-filter-bar={String(showFilterBar)}
      data-testid="dq-filter-bar">
      <button data-testid="clear-all" onClick={clearAll}>
        clear
      </button>
    </div>
  ),
}));

jest.mock('./DqSectionCard', () => ({
  __esModule: true,
  default: ({
    children,
    title,
    subtitle,
    className,
  }: {
    children?: ReactNode;
    title?: ReactNode;
    subtitle?: ReactNode;
    className?: string;
  }) => (
    <div
      className={className}
      data-subtitle={subtitle}
      data-testid="dq-section-card"
      data-title={title}>
      {children}
    </div>
  ),
}));

jest.mock(
  'openmetadata-ui/src/components/DataQuality/DataQualityDashboard/data-quality-dashboard.style.less',
  () => ({})
);

const baseHookReturn = {
  defaultFilters: { foo: 'bar' },
  pieChartFilters: { baz: 'qux' },
  dateRange: { startTs: 1, endTs: 2 },
  onDateRangeChange: jest.fn(),
  filters: [],
  showFilterBar: true,
  hasVisibleFilters: false,
  hasActiveFilters: false,
  clearAll: jest.fn(),
};

describe('DataQualityDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDataQualityDashboardFilters.mockReturnValue(baseHookReturn);
  });

  it('should render the filter bar', () => {
    render(<DataQualityDashboard />);

    expect(screen.getByTestId('dq-filter-bar')).toBeInTheDocument();
  });

  it('should apply borderless styles only to the matching AI sections', () => {
    render(<DataQualityDashboard />);

    const cards = screen.getAllByTestId('dq-section-card');

    expect(cards[1]).toHaveClass(
      'tw:[&_.status-card-widget-container]:border-0',
      'tw:[&_.status-card-widget-container]:bg-gray-blue-25'
    );
    expect(cards[2]).not.toHaveClass(
      'tw:[&_.status-card-widget-container]:border-0',
      'tw:[&_.custom-chart-background]:border-0'
    );
    expect(cards[3]).toHaveClass(
      'tw:[&_.custom-chart-background]:border-0',
      'tw:[&_.custom-chart-background]:bg-gray-blue-25'
    );
  });

  it('should render a section card per dashboard section', () => {
    render(<DataQualityDashboard />);

    const cards = screen.getAllByTestId('dq-section-card');

    expect(cards).toHaveLength(4);
  });

  it('should render section content for each section key', () => {
    render(<DataQualityDashboard />);

    expect(
      screen.getByTestId('section-content-data-health')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('section-content-incident-metrics')
    ).toBeInTheDocument();
  });

  it('should pass active/visible filter flags from the hook to the filter bar', () => {
    mockUseDataQualityDashboardFilters.mockReturnValue({
      ...baseHookReturn,
      hasActiveFilters: true,
      hasVisibleFilters: true,
      showFilterBar: false,
    });

    render(<DataQualityDashboard />);

    const bar = screen.getByTestId('dq-filter-bar');

    expect(bar).toHaveAttribute('data-has-active-filters', 'true');
    expect(bar).toHaveAttribute('data-has-visible-filters', 'true');
    expect(bar).toHaveAttribute('data-show-filter-bar', 'false');
  });

  it('should forward default and pie chart filters to section content', () => {
    render(<DataQualityDashboard />);

    const content = screen.getByTestId('section-content-data-health');

    expect(content).toHaveAttribute(
      'data-default-filters',
      JSON.stringify(baseHookReturn.defaultFilters)
    );
    expect(content).toHaveAttribute(
      'data-pie-chart-filters',
      JSON.stringify(baseHookReturn.pieChartFilters)
    );
  });

  it('should pass the router navigate function to chart sections', () => {
    render(<DataQualityDashboard />);

    expect(screen.getByTestId('section-content-data-health')).toHaveAttribute(
      'data-has-navigate',
      'true'
    );
  });

  it('should apply the data-health class only to the data-health card', () => {
    render(<DataQualityDashboard />);

    const cards = screen.getAllByTestId('dq-section-card');

    expect(cards[0]).toHaveClass('data-quality-dashboard-card-section');
    expect(cards[1]).not.toHaveClass('data-quality-dashboard-card-section');
  });
});
