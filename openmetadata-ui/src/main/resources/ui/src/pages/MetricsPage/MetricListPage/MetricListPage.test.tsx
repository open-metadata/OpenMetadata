/*
 *  Copyright 2025 Collate.
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
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { METRICS_DOCS } from '../../../constants/docs.constants';
import { EntityType } from '../../../enums/entity.enum';
import { getEntityBulkEditPath } from '../../../utils/EntityPureUtils';

import MetricListPage from './MetricListPage';

const mockNavigate = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: jest
    .fn()
    .mockImplementation(({ initials }) => <span>{initials}</span>),
  Badge: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Button: jest
    .fn()
    .mockImplementation(
      ({ children, onClick, onPress, 'data-testid': testId, isDisabled }) => (
        <button
          data-testid={testId}
          disabled={isDisabled}
          onClick={onPress ?? onClick}>
          {children}
        </button>
      )
    ),
  ButtonUtility: jest
    .fn()
    .mockImplementation(
      ({ icon, onClick, className, 'data-testid': testId }) => (
        <button className={className} data-testid={testId} onClick={onClick}>
          {icon}
        </button>
      )
    ),
  FeaturedIcon: jest.fn().mockImplementation(({ icon }) => <span>{icon}</span>),
  Input: jest
    .fn()
    .mockImplementation(({ placeholder, value, onChange }) => (
      <input placeholder={placeholder} value={value} onChange={onChange} />
    )),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Dropdown: {
    DotsButton: jest
      .fn()
      .mockImplementation(({ 'data-testid': testId }) => (
        <button data-testid={testId}>Actions</button>
      )),
    Item: jest.fn().mockImplementation(({ label }) => <div>{label}</div>),
    Menu: jest.fn().mockImplementation(({ children, onAction }) => (
      <div>
        {(Array.isArray(children) ? children : [children]).flat().map((child) =>
          child?.props?.id ? (
            <button
              data-testid={`status-option-${child.props.id}`}
              key={child.props.id}
              type="button"
              onClick={() => onAction?.(child.props.id)}>
              {child.props.label}
            </button>
          ) : (
            child
          )
        )}
      </div>
    )),
    Popover: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Root: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  },
  defaultColors: { gray: { 50: '#fafafa' } },
}));

const mockLocationPathname = '/mock-path';
// Mocking react-router-dom hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  useNavigate: jest.fn(() => mockNavigate),
}));

// Mock permission provider to simulate access rights
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      metric: { ViewAll: true, ViewBasic: true, Create: true },
    },
    getResourcePermission: jest.fn().mockResolvedValue({
      ViewAll: true,
      ViewBasic: true,
      Create: true,
      Delete: true,
      EditAll: true,
    }),
  }),
}));

// Mock metrics API to return an empty list
jest.mock('../../../rest/metricsAPI', () => ({
  getMetrics: jest.fn().mockResolvedValue({
    data: [],
    paging: {},
  }),
  exportMetricDetailsInCSV: jest.fn().mockResolvedValue({}),
  deleteMetricAsync: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
  showWarningToast: jest.fn(),
}));

// Mock the empty state placeholder to render a docs link
jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => ({
    __esModule: true,
    default: ({ doc }: { doc: string }) => (
      <div data-testid="error-placeholder">
        <a href={doc} rel="noreferrer" target="_blank">
          docs
        </a>
      </div>
    ),
  })
);

jest.mock('../../../components/common/Table/TableV2', () => ({
  __esModule: true,
  default: ({
    dataSource,
    locale,
    rowSelection,
  }: {
    dataSource: Array<{ id: string; name: string }>;
    locale: { emptyText: React.ReactNode };
    rowSelection?: { onChange: (keys: string[]) => void };
  }) => (
    <div>
      {dataSource.length ? (
        <>
          <button
            data-testid="select-first-metric"
            onClick={() => rowSelection?.onChange([dataSource[0].id])}>
            select
          </button>
          {dataSource.map((metric) => (
            <span key={metric.id}>{metric.name}</span>
          ))}
        </>
      ) : (
        locale.emptyText
      )}
    </div>
  ),
}));

jest.mock(
  '../../../components/common/EntityImport/CsvJobsTray/CsvJobsTray.component',
  () => ({
    CSV_JOBS_REFRESH_EVENT: 'csv-jobs-refresh',
    CsvJobsTray: jest.fn(() => <div data-testid="csv-jobs-tray" />),
  })
);

// Mock PageLayoutV1 to simply render children without layout logic
jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../../components/PageHeader/PageHeader.component', () => ({
  __esModule: true,
  default: ({ data }: { data: { header: string; subHeader: string } }) => (
    <div data-testid="page-header">{data.header}</div>
  ),
}));

jest.mock('../../../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('MetricListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getMetrics } = require('../../../rest/metricsAPI');
    getMetrics.mockResolvedValue({
      data: [],
      paging: {},
    });
  });

  it('renders the docs link with correct URL when empty state is shown', async () => {
    render(
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    );

    const link = await screen.findByText('docs');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', METRICS_DOCS);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('passes filtered metric scope when bulk edit is clicked without selection', async () => {
    render(
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    );

    const searchInput = await screen.findByPlaceholderText(
      'label.search-entity'
    );

    fireEvent.change(searchInput, { target: { value: 'sales' } });
    fireEvent.click(screen.getByTestId('bulk-edit-metric'));

    expect(mockNavigate).toHaveBeenCalledWith(
      getEntityBulkEditPath(EntityType.METRIC, '*'),
      {
        state: {
          metricBulkEditScope: {
            mode: 'filtered',
            filters: {
              searchText: 'sales',
              statusFilter: undefined,
            },
          },
        },
      }
    );
  });

  it('passes selected metric scope when selected rows are bulk edited', async () => {
    const { getMetrics } = require('../../../rest/metricsAPI');
    getMetrics.mockResolvedValue({
      data: [
        {
          id: 'metric-id',
          name: 'net_sales',
          displayName: 'Net Sales',
        },
      ],
      paging: {},
    });

    render(
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('select-first-metric'));
    fireEvent.click(screen.getByTestId('bulk-edit-metric'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        getEntityBulkEditPath(EntityType.METRIC, '*'),
        {
          state: {
            metricBulkEditScope: {
              mode: 'selected',
              metricIds: ['metric-id'],
              metricNames: ['net_sales'],
              filters: {
                searchText: '',
                statusFilter: undefined,
              },
            },
          },
        }
      );
    });
  });

  it('starts async export directly from the listing action menu', async () => {
    const { exportMetricDetailsInCSV } = require('../../../rest/metricsAPI');
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');

    render(
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('label.export'));

    await waitFor(() => {
      expect(exportMetricDetailsInCSV).toHaveBeenCalledWith('*');
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'csv-jobs-refresh' })
      );
    });

    dispatchEventSpy.mockRestore();
  });

  it('filters the listing by status across every page of metrics', async () => {
    const { getMetrics } = require('../../../rest/metricsAPI');
    // Approved metric on page 1, Draft metric on page 2. The listing must load
    // every page so the Status filter sees metrics beyond the first page.
    getMetrics.mockImplementation((params: { after?: string }) =>
      Promise.resolve(
        params?.after
          ? {
              data: [
                {
                  id: 'd1',
                  name: 'draft_metric_two',
                  fullyQualifiedName: 'd2',
                  entityStatus: 'Draft',
                },
              ],
              paging: { total: 2 },
            }
          : {
              data: [
                {
                  id: 'a1',
                  name: 'approved_metric',
                  fullyQualifiedName: 'a1',
                  entityStatus: 'Approved',
                },
              ],
              paging: { after: 'cursor-2', total: 2 },
            }
      )
    );

    render(
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('approved_metric')).toBeInTheDocument();
    expect(screen.getByText('draft_metric_two')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('status-option-Draft'));

    expect(screen.getByText('draft_metric_two')).toBeInTheDocument();
    expect(screen.queryByText('approved_metric')).not.toBeInTheDocument();
  });

  it('warns when the metric list exceeds the fetch cap', async () => {
    const { getMetrics } = require('../../../rest/metricsAPI');
    const { showWarningToast } = require('../../../utils/ToastUtils');
    let page = 0;
    // Always return another page so the fetch loop hits its page cap.
    getMetrics.mockImplementation(() => {
      page += 1;

      return Promise.resolve({
        data: [
          {
            id: `m-${page}`,
            name: `metric-${page}`,
            fullyQualifiedName: `m-${page}`,
            entityStatus: 'Draft',
          },
        ],
        paging: { after: `cursor-${page}` },
      });
    });

    render(
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(showWarningToast).toHaveBeenCalled());
  });
});
