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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchDropdownOption } from '../../../components/SearchDropdown/SearchDropdown.interface';
import {
  ABORTED_CHART_COLOR_SCHEME,
  FAILED_CHART_COLOR_SCHEME,
  SUCCESS_CHART_COLOR_SCHEME,
} from '../../../constants/Chart.constants';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { getDataQualityPagePath } from '../../../utils/RouterUtils';
import { IncidentTimeMetricsType } from '../DataQuality.interface';
import DataQualityDashboard from './DataQualityDashboard.component';

const mockGetTags = jest.fn().mockResolvedValue({
  data: [
    { id: '1', name: 'Tier1', fullyQualifiedName: 'Tier.Tier1' },
    { id: '2', name: 'Tier2', fullyQualifiedName: 'Tier.Tier2' },
  ],
});

const mockSearchQuery = jest.fn().mockResolvedValue({
  hits: {
    hits: [
      {
        _source: {
          id: '1',
          name: 'TestTag',
          fullyQualifiedName: 'Classification.TestTag',
          classification: { name: 'Classification' },
        },
      },
    ],
  },
});

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    className,
    ...props
  }: React.PropsWithChildren<{ className?: string }>) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
  Card: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  Grid: Object.assign(
    ({
      children,
      className,
      ...props
    }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    {
      Item: ({
        children,
        className,
        ...props
      }: React.PropsWithChildren<{ className?: string }>) => (
        <div className={className} {...props}>
          {children}
        </div>
      ),
    }
  ),
  Tooltip: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <>{children}</>
  ),
  TooltipTrigger: ({
    children,
  }: React.PropsWithChildren<Record<string, unknown>>) => <>{children}</>,
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDataQualityPagePath: jest.fn((tab: string) => `/data-quality/${tab}`),
}));

jest.mock('../../../components/PageHeader/PageHeader.component', () =>
  jest.fn().mockImplementation(() => <div data-testid="page-header" />)
);

jest.mock('../../../rest/tagAPI', () => ({
  getTags: () => mockGetTags(),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

jest.mock(
  '../../../components/common/DatePickerMenu/DatePickerMenu.component',
  () =>
    jest.fn().mockImplementation(({ handleDateRangeChange }) => (
      <button
        data-testid="date-picker-menu"
        onClick={() => handleDateRangeChange({ startTs: 1, endTs: 2 })}>
        DatePickerMenu
      </button>
    ))
);

jest.mock(
  '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest
      .fn()
      .mockImplementation(({ onUpdate, children }) => (
        <div>
          {children}
          <button
            data-testid="user-team-selectable-list"
            onClick={() => onUpdate([{ id: '1', name: 'owner1' }])}>
            UserTeamSelectableList
          </button>
        </div>
      )),
  })
);

jest.mock('../../../components/SearchDropdown/SearchDropdown', () =>
  jest
    .fn()
    .mockImplementation(({ label, onChange, onSearch, selectedKeys }) => (
      <div>
        <button
          data-testid={`search-dropdown-${label}`}
          onClick={() => onChange([{ key: 'tag1', label: 'Tag 1' }])}>
          {label} SearchDropdown
        </button>
        {onSearch && (
          <button
            data-testid={`search-dropdown-search-${label}`}
            onClick={() => onSearch('pii')}>
            Search {label}
          </button>
        )}
        {selectedKeys
          .map((option: SearchDropdownOption) => option.label)
          .join(', ')}
      </div>
    ))
);
jest.mock('../../../utils/AdvancedSearchUtils', () => {
  return {
    getSelectedOptionLabelString: jest
      .fn()
      .mockImplementation((selectedOptions) =>
        selectedOptions
          .map((option: SearchDropdownOption) => option.label)
          .join(', ')
      ),
  };
});

jest.mock(
  '../ChartWidgets/TestCaseStatusPieChartWidget/TestCaseStatusPieChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="test-case-status-pie-chart-widget">
          TestCaseStatusPieChartWidget
        </div>
      ))
);

jest.mock(
  '../ChartWidgets/EntityHealthStatusPieChartWidget/EntityHealthStatusPieChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="entity-health-status-pie-chart-widget">
          EntityHealthStatusPieChartWidget
        </div>
      ))
);

jest.mock(
  '../ChartWidgets/DataAssetsCoveragePieChartWidget/DataAssetsCoveragePieChartWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="data-assets-coverage-pie-chart-widget">
          DataAssetsCoveragePieChartWidget
        </div>
      ))
);

jest.mock(
  '../ChartWidgets/StatusByDimensionCardWidget/StatusByDimensionCardWidget.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="status-by-dimension-card-widget">
          StatusByDimensionCardWidget
        </div>
      ))
);

// Mock chart widgets to capture props for testing
const mockTestCaseStatusAreaChartWidget = jest.fn();
const mockIncidentTypeAreaChartWidget = jest.fn();
const mockIncidentTimeChartWidget = jest.fn();

jest.mock(
  '../ChartWidgets/TestCaseStatusAreaChartWidget/TestCaseStatusAreaChartWidget.component',
  () =>
    jest.fn().mockImplementation((props) => {
      mockTestCaseStatusAreaChartWidget(props);

      return (
        <div data-testid={`test-case-status-area-chart-widget-${props.name}`}>
          TestCaseStatusAreaChartWidget {props.name}
        </div>
      );
    })
);

jest.mock(
  '../ChartWidgets/IncidentTypeAreaChartWidget/IncidentTypeAreaChartWidget.component',
  () =>
    jest.fn().mockImplementation((props) => {
      mockIncidentTypeAreaChartWidget(props);

      return (
        <div data-testid={`incident-type-area-chart-widget-${props.name}`}>
          IncidentTypeAreaChartWidget {props.name}
        </div>
      );
    })
);

jest.mock(
  '../ChartWidgets/IncidentTimeChartWidget/IncidentTimeChartWidget.component',
  () =>
    jest.fn().mockImplementation((props) => {
      mockIncidentTimeChartWidget(props);

      return (
        <div data-testid={`incident-time-chart-widget-${props.name}`}>
          IncidentTimeChartWidget {props.name}
        </div>
      );
    })
);

// Pie chart widgets capture props so we can assert filter wiring
const mockDataAssetsCoveragePieChartWidget = jest.fn();
const mockEntityHealthStatusPieChartWidget = jest.fn();
const mockTestCaseStatusPieChartWidget = jest.fn();

// Re-mock pie chart widgets to also capture props
jest.mock(
  '../ChartWidgets/TestCaseStatusPieChartWidget/TestCaseStatusPieChartWidget.component',
  () =>
    jest.fn().mockImplementation((props) => {
      mockTestCaseStatusPieChartWidget(props);

      return (
        <div data-testid="test-case-status-pie-chart-widget">
          TestCaseStatusPieChartWidget
        </div>
      );
    })
);

jest.mock(
  '../ChartWidgets/EntityHealthStatusPieChartWidget/EntityHealthStatusPieChartWidget.component',
  () =>
    jest.fn().mockImplementation((props) => {
      mockEntityHealthStatusPieChartWidget(props);

      return (
        <div data-testid="entity-health-status-pie-chart-widget">
          EntityHealthStatusPieChartWidget
        </div>
      );
    })
);

jest.mock(
  '../ChartWidgets/DataAssetsCoveragePieChartWidget/DataAssetsCoveragePieChartWidget.component',
  () =>
    jest.fn().mockImplementation((props) => {
      mockDataAssetsCoveragePieChartWidget(props);

      return (
        <div data-testid="data-assets-coverage-pie-chart-widget">
          DataAssetsCoveragePieChartWidget
        </div>
      );
    })
);

describe('DataQualityDashboard', () => {
  it('should render the DataQualityDashboard component', async () => {
    render(<DataQualityDashboard />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('dq-dashboard-container')).toBeInTheDocument();
    expect(screen.getByTestId('user-team-selectable-list')).toBeInTheDocument();
    expect(
      screen.getByTestId('search-dropdown-label.tier')
    ).toBeInTheDocument();
    expect(screen.getByTestId('search-dropdown-label.tag')).toBeInTheDocument();
    expect(
      screen.getByTestId('search-dropdown-label.data-product')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('search-dropdown-label.glossary-term')
    ).toBeInTheDocument();
    expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-status-pie-chart-widget')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('entity-health-status-pie-chart-widget')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('data-assets-coverage-pie-chart-widget')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('status-by-dimension-card-widget')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-status-area-chart-widget-success')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-status-area-chart-widget-aborted')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('test-case-status-area-chart-widget-failed')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-type-area-chart-widget-open-incident')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-type-area-chart-widget-resolved-incident')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-time-chart-widget-response-time')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-time-chart-widget-resolution-time')
    ).toBeInTheDocument();
  });

  it('should handle owner filter change', async () => {
    render(<DataQualityDashboard />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByTestId('user-team-selectable-list'));

    await waitFor(() => {
      expect(screen.getByText('owner1')).toBeInTheDocument();
    });
  });

  it('should handle tier filter change', async () => {
    render(<DataQualityDashboard />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByTestId('search-dropdown-label.tier'));

    await waitFor(() => {
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });
  });

  it('should handle date range change', async () => {
    render(<DataQualityDashboard />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByTestId('date-picker-menu'));

    await waitFor(() => {
      expect(screen.getByText('DatePickerMenu')).toBeInTheDocument();
    });
  });

  describe('Chart Widget Props and Configuration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should pass correct color schemes to TestCaseStatusAreaChartWidget components', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalled();
      });

      // Verify success widget gets success color scheme
      expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          chartColorScheme: SUCCESS_CHART_COLOR_SCHEME,
          testCaseStatus: TestCaseStatus.Success,
          name: 'success',
          title: 'label.success',
        })
      );

      // Verify aborted widget gets aborted color scheme
      expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          chartColorScheme: ABORTED_CHART_COLOR_SCHEME,
          testCaseStatus: TestCaseStatus.Aborted,
          name: 'aborted',
          title: 'label.aborted',
        })
      );

      // Verify failed widget gets failed color scheme
      expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          chartColorScheme: FAILED_CHART_COLOR_SCHEME,
          testCaseStatus: TestCaseStatus.Failed,
          name: 'failed',
          title: 'label.failed',
        })
      );
    });

    it('should pass correct redirect paths to TestCaseStatusAreaChartWidget components', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalled();
      });

      // Check success widget redirect path
      expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectPath: {
            pathname: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
            search: 'testCaseStatus=Success',
          },
        })
      );

      // Check failed widget redirect path
      expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectPath: {
            pathname: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
            search: 'testCaseStatus=Failed',
          },
        })
      );
    });

    it('should pass correct props to IncidentTypeAreaChartWidget components', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockIncidentTypeAreaChartWidget).toHaveBeenCalled();
      });

      // Check open incident widget
      expect(mockIncidentTypeAreaChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentStatusType: TestCaseResolutionStatusTypes.New,
          name: 'open-incident',
          title: 'label.open-incident-plural',
          redirectPath: expect.objectContaining({
            pathname: '/incident-manager',
            search: expect.stringContaining('testCaseResolutionStatusType=New'),
          }),
        })
      );

      // Check resolved incident widget
      expect(mockIncidentTypeAreaChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentStatusType: TestCaseResolutionStatusTypes.Resolved,
          name: 'resolved-incident',
          title: 'label.resolved-incident-plural',
          redirectPath: expect.objectContaining({
            pathname: '/incident-manager',
            search: expect.stringContaining(
              'testCaseResolutionStatusType=Resolved'
            ),
          }),
        })
      );
    });

    it('should pass correct props to IncidentTimeChartWidget components', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockIncidentTimeChartWidget).toHaveBeenCalled();
      });

      // Check response time widget
      expect(mockIncidentTimeChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentMetricType: IncidentTimeMetricsType.TIME_TO_RESPONSE,
          name: 'response-time',
          title: 'label.response-time',
        })
      );

      // Check resolution time widget
      expect(mockIncidentTimeChartWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentMetricType: IncidentTimeMetricsType.TIME_TO_RESOLUTION,
          name: 'resolution-time',
          title: 'label.resolution-time',
        })
      );
    });
  });

  describe('Filter State Management', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle tag filter changes and update chart filters', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(screen.getByTestId('search-dropdown-label.tag'));

      await waitFor(() => {
        // Verify that all chart widgets receive the updated filters
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: ['tag1'],
            }),
          })
        );
      });
    });

    it('should handle glossary term filter changes', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(
        screen.getByTestId('search-dropdown-label.glossary-term')
      );

      await waitFor(() => {
        // Verify glossary terms are included in tag filters for widgets
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: ['tag1'],
            }),
          })
        );
      });
    });

    it('should merge tag and glossary term filters correctly', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      // Apply both tag and glossary term filters
      fireEvent.click(screen.getByTestId('search-dropdown-label.tag'));
      fireEvent.click(
        screen.getByTestId('search-dropdown-label.glossary-term')
      );

      await waitFor(() => {
        // Should merge both filter types into tags array
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: expect.arrayContaining(['tag1']),
            }),
          })
        );
      });
    });

    it('should handle owner filter changes', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(screen.getByTestId('user-team-selectable-list'));

      await waitFor(() => {
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              ownerFqn: 'owner1',
            }),
          })
        );
      });
    });
  });

  describe('API Integration and Error Handling', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle component mount successfully', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      // Component should render successfully despite any API loading states
      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully for tag fetching', async () => {
      mockGetTags.mockRejectedValueOnce(new Error('API Error'));

      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      // Component should still render despite API error
      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });
    });

    it('should handle search API errors gracefully', async () => {
      mockSearchQuery.mockRejectedValueOnce(new Error('Search API Error'));

      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      // Component should still render despite search API error
      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Structure and Layout', () => {
    it('should render dashboard sections with correct export classes', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      const exportContainers = document.querySelectorAll(
        '.export-pdf-container'
      );

      expect(exportContainers).toHaveLength(4); // Data Health, Dimensions, Test Cases, Incidents
    });

    it('should render dashboard sections with correct card classes', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      const cardSections = document.querySelectorAll(
        '.data-quality-dashboard-card-section'
      );

      expect(cardSections).toHaveLength(4);
    });

    it('should render grid layout correctly', async () => {
      const { container } = render(<DataQualityDashboard />, {
        wrapper: MemoryRouter,
      });

      const mainContainer = container.querySelector(
        '.m-b-md[data-testid="dq-dashboard-container"]'
      );

      expect(mainContainer).toBeInTheDocument();

      // Four chart card sections rendered inside the grid
      const sections = container.querySelectorAll('.export-pdf-container');

      expect(sections).toHaveLength(4);
    });
  });

  describe('Date Range Handling', () => {
    it('should initialize with default 30-day range', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        // Check that widgets receive chart filters with proper date range
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              startTs: expect.any(Number),
              endTs: expect.any(Number),
            }),
          })
        );
      });
    });

    it('should update chart filters when date range changes', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(screen.getByTestId('date-picker-menu'));

      await waitFor(() => {
        // Should trigger re-render with new date range
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalled();
      });
    });
  });

  describe('User Interface Elements', () => {
    it('should display date range UI elements', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      // Should show date picker component
      await waitFor(() => {
        expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
      });
    });

    it('should show selected filter values in dropdown buttons', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(screen.getByTestId('user-team-selectable-list'));

      await waitFor(() => {
        expect(screen.getByText('owner1')).toBeInTheDocument();
      });
    });
  });

  describe('hideFilterBar prop', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('hides Owner, Tier, Tag, Data Product and Glossary Term dropdowns when hideFilterBar is true', async () => {
      render(<DataQualityDashboard hideFilterBar />, { wrapper: MemoryRouter });

      expect(
        screen.queryByTestId('user-team-selectable-list')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.tier')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.tag')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.data-product')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.glossary-term')
      ).not.toBeInTheDocument();
    });

    it('still renders the date picker when hideFilterBar is true', async () => {
      render(<DataQualityDashboard hideFilterBar />, { wrapper: MemoryRouter });

      expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
    });

    it('still renders all chart widgets when hideFilterBar is true', async () => {
      render(<DataQualityDashboard hideFilterBar />, { wrapper: MemoryRouter });

      expect(
        screen.getByTestId('test-case-status-pie-chart-widget')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('entity-health-status-pie-chart-widget')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('data-assets-coverage-pie-chart-widget')
      ).toBeInTheDocument();
    });

    it('does not call tier/tag/glossary APIs when hideFilterBar is true', async () => {
      render(<DataQualityDashboard hideFilterBar />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });

      expect(mockGetTags).not.toHaveBeenCalled();
      expect(mockSearchQuery).not.toHaveBeenCalled();
    });

    it('does not call APIs when hideFilterBar is true even with hiddenFilters set', async () => {
      render(<DataQualityDashboard hideFilterBar hiddenFilters={['tags']} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });

      expect(mockGetTags).not.toHaveBeenCalled();
      expect(mockSearchQuery).not.toHaveBeenCalled();
    });

    it('calls tier/tag/glossary APIs when hideFilterBar is false (default)', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockGetTags).toHaveBeenCalled();
        expect(mockSearchQuery).toHaveBeenCalled();
      });
    });
  });

  describe('initialFilters prop', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('passes initialFilters.tags to pie chart widgets', async () => {
      render(
        <DataQualityDashboard
          hideFilterBar
          initialFilters={{ tags: ['PII.Sensitive'] }}
        />,
        { wrapper: MemoryRouter }
      );

      await waitFor(() => {
        expect(mockTestCaseStatusPieChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: ['PII.Sensitive'],
            }),
          })
        );
      });
    });

    it('passes initialFilters.domainFqn to pie chart widgets', async () => {
      render(
        <DataQualityDashboard
          hideFilterBar
          initialFilters={{ domainFqn: 'Engineering' }}
        />,
        { wrapper: MemoryRouter }
      );

      await waitFor(() => {
        expect(mockTestCaseStatusPieChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              domainFqn: 'Engineering',
            }),
          })
        );
      });
    });

    it('passes initialFilters.glossaryTerms merged into tags for pie chart widgets', async () => {
      render(
        <DataQualityDashboard
          hideFilterBar
          initialFilters={{ glossaryTerms: ['Finance.Revenue'] }}
        />,
        { wrapper: MemoryRouter }
      );

      await waitFor(() => {
        expect(mockTestCaseStatusPieChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: ['Finance.Revenue'],
            }),
          })
        );
      });
    });

    it('merges initialFilters.tags and glossaryTerms into a single tags array', async () => {
      render(
        <DataQualityDashboard
          hideFilterBar
          initialFilters={{
            tags: ['PII.Sensitive'],
            glossaryTerms: ['Finance.Revenue'],
          }}
        />,
        { wrapper: MemoryRouter }
      );

      await waitFor(() => {
        expect(mockTestCaseStatusPieChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: expect.arrayContaining([
                'PII.Sensitive',
                'Finance.Revenue',
              ]),
            }),
          })
        );
      });
    });

    it('passes initialFilters.ownerFqn to pie chart widgets', async () => {
      render(
        <DataQualityDashboard
          hideFilterBar
          initialFilters={{ ownerFqn: 'john.doe' }}
        />,
        { wrapper: MemoryRouter }
      );

      await waitFor(() => {
        expect(mockTestCaseStatusPieChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              ownerFqn: 'john.doe',
            }),
          })
        );
      });
    });
  });

  describe('className prop', () => {
    it('applies custom className to the root container', () => {
      const { container } = render(
        <DataQualityDashboard className="my-custom-class" />,
        { wrapper: MemoryRouter }
      );

      expect(
        container.querySelector(
          '.my-custom-class[data-testid="dq-dashboard-container"]'
        )
      ).toBeInTheDocument();
    });

    it('always includes m-b-md class on the root container', () => {
      const { container } = render(<DataQualityDashboard />, {
        wrapper: MemoryRouter,
      });

      expect(
        container.querySelector('.m-b-md[data-testid="dq-dashboard-container"]')
      ).toBeInTheDocument();
    });
  });

  describe('hiddenFilters prop', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('hides only the tags dropdown when hiddenFilters includes tags', () => {
      render(<DataQualityDashboard hiddenFilters={['tags']} />, {
        wrapper: MemoryRouter,
      });

      expect(
        screen.queryByTestId('search-dropdown-label.tag')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('user-team-selectable-list')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.tier')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.glossary-term')
      ).toBeInTheDocument();
    });

    it('hides only the glossary term dropdown when hiddenFilters includes glossaryTerms', () => {
      render(<DataQualityDashboard hiddenFilters={['glossaryTerms']} />, {
        wrapper: MemoryRouter,
      });

      expect(
        screen.queryByTestId('search-dropdown-label.glossary-term')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('user-team-selectable-list')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.tier')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.tag')
      ).toBeInTheDocument();
    });

    it('hides only the tier dropdown when hiddenFilters includes tier', () => {
      render(<DataQualityDashboard hiddenFilters={['tier']} />, {
        wrapper: MemoryRouter,
      });

      expect(
        screen.queryByTestId('search-dropdown-label.tier')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('user-team-selectable-list')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.tag')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.glossary-term')
      ).toBeInTheDocument();
    });

    it('hides only the owner filter when hiddenFilters includes owner', () => {
      render(<DataQualityDashboard hiddenFilters={['owner']} />, {
        wrapper: MemoryRouter,
      });

      expect(
        screen.queryByTestId('user-team-selectable-list')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.tier')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.tag')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.glossary-term')
      ).toBeInTheDocument();
    });

    it('does not call getTags API when tier is in hiddenFilters', async () => {
      render(<DataQualityDashboard hiddenFilters={['tier']} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });

      expect(mockGetTags).not.toHaveBeenCalled();
    });

    it('does not call tag search API when tags is in hiddenFilters', async () => {
      render(
        <DataQualityDashboard hiddenFilters={['tags', 'dataProducts']} />,
        {
          wrapper: MemoryRouter,
        }
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });

      // only glossaryTerms fetch runs — searchQuery called once, not twice
      expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    });

    it('does not call glossary term search API when glossaryTerms is in hiddenFilters', async () => {
      render(
        <DataQualityDashboard
          hiddenFilters={['glossaryTerms', 'dataProducts']}
        />,
        {
          wrapper: MemoryRouter,
        }
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('dq-dashboard-container')
        ).toBeInTheDocument();
      });

      // only tags fetch runs — searchQuery called once, not twice
      expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    });

    it('hideFilterBar is a hard override — hides the entire bar even when hiddenFilters is set', () => {
      render(<DataQualityDashboard hideFilterBar hiddenFilters={['tags']} />, {
        wrapper: MemoryRouter,
      });

      // hideFilterBar=true is a hard override: entire filter bar is hidden regardless of hiddenFilters
      expect(
        screen.queryByTestId('user-team-selectable-list')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.tier')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.glossary-term')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.tag')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.data-product')
      ).not.toBeInTheDocument();
    });
  });

  describe('isGovernanceView prop', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders governance layout structure instead of Row layout', () => {
      const { container } = render(<DataQualityDashboard isGovernanceView />, {
        wrapper: MemoryRouter,
      });

      expect(
        container.querySelector('.data-quality-governance-layout')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.data-quality-governance-filter-bar')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.data-quality-governance-charts')
      ).toBeInTheDocument();
    });

    it('does not use Row layout m-b-md class in governance view', () => {
      const { container } = render(<DataQualityDashboard isGovernanceView />, {
        wrapper: MemoryRouter,
      });

      expect(
        container.querySelector('.m-b-md[data-testid="dq-dashboard-container"]')
      ).not.toBeInTheDocument();
    });

    it('applies dq-dashboard-container testid to governance layout div', () => {
      render(<DataQualityDashboard isGovernanceView />, {
        wrapper: MemoryRouter,
      });

      expect(screen.getByTestId('dq-dashboard-container')).toBeInTheDocument();
    });

    it('applies borderless styling to all 4 card sections in governance view', () => {
      const { container } = render(<DataQualityDashboard isGovernanceView />, {
        wrapper: MemoryRouter,
      });

      expect(
        container.querySelectorAll(String.raw`.tw\:ring-0.tw\:shadow-none`)
      ).toHaveLength(4);
    });

    it('does not apply borderless styling in default view', () => {
      const { container } = render(<DataQualityDashboard />, {
        wrapper: MemoryRouter,
      });

      expect(
        container.querySelector(String.raw`.tw\:ring-0.tw\:shadow-none`)
      ).not.toBeInTheDocument();
    });

    it('renders all chart widgets inside governance charts area', () => {
      render(<DataQualityDashboard isGovernanceView />, {
        wrapper: MemoryRouter,
      });

      expect(
        screen.getByTestId('test-case-status-pie-chart-widget')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('entity-health-status-pie-chart-widget')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('data-assets-coverage-pie-chart-widget')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('status-by-dimension-card-widget')
      ).toBeInTheDocument();
    });

    it('applies custom className to governance layout root', () => {
      const { container } = render(
        <DataQualityDashboard isGovernanceView className="custom-governance" />,
        { wrapper: MemoryRouter }
      );

      expect(
        container.querySelector(
          '.custom-governance.data-quality-governance-layout'
        )
      ).toBeInTheDocument();
    });

    it('combines isGovernanceView with hiddenFilters correctly', () => {
      const { container } = render(
        <DataQualityDashboard isGovernanceView hiddenFilters={['tags']} />,
        { wrapper: MemoryRouter }
      );

      expect(
        container.querySelector('.data-quality-governance-layout')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('search-dropdown-label.tag')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('search-dropdown-label.tier')
      ).toBeInTheDocument();
    });

    it('passes initialFilters to chart widgets in governance view', async () => {
      render(
        <DataQualityDashboard
          isGovernanceView
          initialFilters={{ tags: ['PII.Sensitive'] }}
        />,
        { wrapper: MemoryRouter }
      );

      await waitFor(() => {
        expect(mockTestCaseStatusPieChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: ['PII.Sensitive'],
            }),
          })
        );
      });
    });
  });

  describe('glossaryTerms to tags merge (defaultFilters)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('glossaryTerms filter change merges into tags for area chart widgets', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(
        screen.getByTestId('search-dropdown-label.glossary-term')
      );

      await waitFor(() => {
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.objectContaining({
              tags: ['tag1'],
            }),
          })
        );
        // glossaryTerms key itself is omitted from defaultFilters
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.not.objectContaining({
            chartFilter: expect.objectContaining({
              glossaryTerms: expect.anything(),
            }),
          })
        );
      });
    });

    it('empty tags and glossaryTerms produce undefined tags in defaultFilters', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockTestCaseStatusAreaChartWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            chartFilter: expect.not.objectContaining({
              tags: expect.anything(),
            }),
          })
        );
      });
    });
  });

  describe('wildcard query fix in fetchTagOptions and fetchGlossaryTermOptions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('calls searchQuery with bare wildcard (*) on mount — not triple-star (***)', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockSearchQuery).toHaveBeenCalled();
      });

      const wildcardCalls = mockSearchQuery.mock.calls.filter(
        (args: unknown[]) => (args[0] as Record<string, unknown>).query === '*'
      );
      const tripleStarCalls = mockSearchQuery.mock.calls.filter(
        (args: unknown[]) =>
          (args[0] as Record<string, unknown>).query === '***'
      );

      expect(wildcardCalls.length).toBeGreaterThanOrEqual(3); // tags + glossaryTerms + data products
      expect(tripleStarCalls).toHaveLength(0);
    });

    it('calls searchQuery with *text* when tag search text is non-empty', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(screen.getByTestId('search-dropdown-search-label.tag'));

      await waitFor(() => {
        const wrappedCalls = mockSearchQuery.mock.calls.filter(
          (args: unknown[]) =>
            (args[0] as Record<string, unknown>).query === '*pii*'
        );

        expect(wrappedCalls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('calls searchQuery with *text* when glossary term search text is non-empty', async () => {
      render(<DataQualityDashboard />, { wrapper: MemoryRouter });

      fireEvent.click(
        screen.getByTestId('search-dropdown-search-label.glossary-term')
      );

      await waitFor(() => {
        const wrappedCalls = mockSearchQuery.mock.calls.filter(
          (args: unknown[]) =>
            (args[0] as Record<string, unknown>).query === '*pii*'
        );

        expect(wrappedCalls.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
