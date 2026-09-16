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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { METRICS_DOCS } from '../../../constants/docs.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  EntityReference,
  EntityStatus,
} from '../../../generated/entity/data/metric';
import { getEntityBulkEditPath } from '../../../utils/EntityPureUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import {
  getDomainPath,
  getEntityDetailsPath,
} from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';

import MetricListPage from './MetricListPage';

const mockNavigate = jest.fn();

const buildSearchResponse = (metrics: Array<Record<string, unknown>>) => ({
  hits: {
    hits: metrics.map((metric) => ({ _source: metric })),
    total: { value: metrics.length },
  },
});

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: jest
    .fn()
    .mockImplementation(({ initials }) => <span>{initials}</span>),
  Badge: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Box: jest
    .fn()
    .mockImplementation(({ children, className, role, onClick }) => (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div className={className} role={role} onClick={onClick}>
        {children}
      </div>
    )),
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
  EmptyPlaceholder: jest
    .fn()
    .mockImplementation(({ title }: { title?: string }) => (
      <div data-testid="metric-empty-placeholder">{title}</div>
    )),
  FeaturedIcon: jest.fn().mockImplementation(({ icon }) => <span>{icon}</span>),
  Input: jest
    .fn()
    .mockImplementation(({ placeholder, value, onChange }) => (
      <input
        aria-label="Search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
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
              {child.props.label ?? child.props.children}
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
    Separator: jest.fn().mockImplementation(() => <hr />),
  },
  defaultColors: { gray: { 50: '#fafafa' } },
}));

jest.mock('../../../utils/ColorUtils', () => ({
  reduceColorOpacity: jest.fn().mockReturnValue('rgba(0,0,0,0.05)'),
}));

const mockLocationPathname = '/mock-path';
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  useNavigate: jest.fn(() => mockNavigate),
}));

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

jest.mock('../../../rest/metricsAPI', () => ({
  exportMetricDetailsInCSV: jest.fn().mockResolvedValue({}),
  deleteMetricAsync: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../hooks/paging/usePaging', () => {
  const handlePageChange = jest.fn();
  const handlePagingChange = jest.fn();
  const handlePageSizeChange = jest.fn();

  return {
    usePaging: () => ({
      paging: { total: 0 },
      handlePagingChange,
      currentPage: 1,
      handlePageChange,
      pageSize: 15,
      handlePageSizeChange,
      showPagination: false,
      pagingCursor: {},
    }),
  };
});

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
  showWarningToast: jest.fn(),
}));

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
    columns,
    dataSource,
    locale,
    rowSelection,
    onRowAction,
  }: {
    columns: Array<{
      key: string;
      dataIndex: string;
      render?: (value: unknown, record: Record<string, unknown>) => ReactNode;
    }>;
    dataSource: Array<Record<string, unknown> & { id: string }>;
    locale: { emptyText: ReactNode };
    rowSelection?: { onChange: (keys: string[]) => void };
    onRowAction?: (key: string) => void;
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
            <div
              key={metric.id}
              role="presentation"
              onClick={() => onRowAction?.(metric.id)}>
              {columns.map((column) => (
                <div key={column.key}>
                  {column.render
                    ? column.render(metric[column.dataIndex], metric)
                    : String(metric[column.dataIndex] ?? '')}
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        locale.emptyText
      )}
    </div>
  ),
}));

jest.mock('../../../components/Tag/TagsViewer/TagsViewer', () => ({
  __esModule: true,
  default: ({ tags }: { tags: Array<{ tagFQN: string }> }) => (
    <>
      {tags.map((tag) => (
        <a href={`/tag/${tag.tagFQN}`} key={tag.tagFQN}>
          {tag.tagFQN}
        </a>
      ))}
    </>
  ),
}));

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

jest.mock('../../../components/common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({ open, onDelete }: { open: boolean; onDelete: () => void }) =>
    open ? (
      <button data-testid="confirm-button" onClick={onDelete}>
        Delete
      </button>
    ) : null,
}));

describe('MetricListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { searchQuery } = require('../../../rest/searchAPI');
    searchQuery.mockResolvedValue(buildSearchResponse([]));
  });

  it('renders the docs link with correct URL when empty state is shown', async () => {
    const { searchQuery } = require('../../../rest/searchAPI');
    searchQuery
      .mockResolvedValueOnce(
        buildSearchResponse([{ id: 'p', name: 'p_metric' }])
      )
      .mockResolvedValue(buildSearchResponse([]));

    renderPage();

    await screen.findByText('p_metric');

    fireEvent.click(screen.getByTestId(`status-option-${EntityStatus.Draft}`));

    const link = await screen.findByText('docs');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', METRICS_DOCS);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('passes filtered metric scope when bulk edit is clicked without selection', async () => {
    const { searchQuery } = require('../../../rest/searchAPI');
    searchQuery.mockResolvedValue(
      buildSearchResponse([{ id: 'p', name: 'p_metric' }])
    );

    renderPage();

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
    const { searchQuery } = require('../../../rest/searchAPI');
    searchQuery.mockResolvedValue(
      buildSearchResponse([
        { id: 'metric-id', name: 'net_sales', displayName: 'Net Sales' },
      ])
    );

    renderPage();

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

    renderPage();

    fireEvent.click(await screen.findByText('label.export'));

    await waitFor(() => {
      expect(exportMetricDetailsInCSV).toHaveBeenCalledWith('*');
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'csv-jobs-refresh' })
      );
    });

    dispatchEventSpy.mockRestore();
  });

  it('filters the listing by status via a server-side search query', async () => {
    const { searchQuery } = require('../../../rest/searchAPI');
    searchQuery.mockImplementation((req: { queryFilter?: unknown }) => {
      const isDraftFilter = JSON.stringify(req.queryFilter ?? {}).includes(
        EntityStatus.Draft
      );

      return Promise.resolve(
        buildSearchResponse(
          isDraftFilter
            ? [{ id: 'd1', name: 'draft_metric', entityStatus: 'Draft' }]
            : [
                { id: 'a1', name: 'approved_metric', entityStatus: 'Approved' },
                { id: 'd1', name: 'draft_metric', entityStatus: 'Draft' },
              ]
        )
      );
    });

    renderPage();

    expect(await screen.findByText('approved_metric')).toBeInTheDocument();
    expect(screen.getByText('draft_metric')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`status-option-${EntityStatus.Draft}`));

    await waitFor(() =>
      expect(screen.queryByText('approved_metric')).not.toBeInTheDocument()
    );

    expect(screen.getByText('draft_metric')).toBeInTheDocument();
    expect(searchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryFilter: getTermQuery({ entityStatus: EntityStatus.Draft }),
      })
    );
  });

  it('applies both the debounced search text and the status filter to the query', async () => {
    const { searchQuery } = require('../../../rest/searchAPI');
    searchQuery.mockResolvedValue(
      buildSearchResponse([{ id: 'p', name: 'p_metric' }])
    );

    renderPage();

    const searchInput = await screen.findByPlaceholderText(
      'label.search-entity'
    );

    fireEvent.change(searchInput, { target: { value: 'sales' } });
    fireEvent.click(screen.getByTestId(`status-option-${EntityStatus.Draft}`));

    await waitFor(
      () =>
        expect(searchQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({
            query: 'sales',
            queryFilter: getTermQuery({ entityStatus: EntityStatus.Draft }),
          })
        ),
      { timeout: 2000 }
    );
  });

  it('does not flash the create placeholder while a cleared search is still pending', async () => {
    const { searchQuery } = require('../../../rest/searchAPI');
    searchQuery.mockImplementation((req: { query?: string }) =>
      Promise.resolve(
        buildSearchResponse(
          req.query === 'zzz' ? [] : [{ id: 'a', name: 'a_metric' }]
        )
      )
    );

    renderPage();

    const searchInput = await screen.findByPlaceholderText(
      'label.search-entity'
    );

    fireEvent.change(searchInput, { target: { value: 'zzz' } });

    await screen.findByTestId('error-placeholder', {}, { timeout: 2000 });

    fireEvent.change(searchInput, { target: { value: '' } });

    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('metric-empty-placeholder')
    ).not.toBeInTheDocument();
  });

  it('surfaces an error when the permission fetch fails', async () => {
    const {
      usePermissionProvider,
    } = require('../../../context/PermissionProvider/PermissionProvider');
    usePermissionProvider.mockReturnValue({
      getResourcePermission: jest
        .fn()
        .mockRejectedValue(new Error('permission boom')),
    });
    const { showErrorToast } = require('../../../utils/ToastUtils');

    renderPage();

    expect(await screen.findByTestId('error-placeholder')).toBeInTheDocument();

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });

  describe('nested cell links', () => {
    const ALL_COLUMNS = [
      'description',
      'glossary',
      'entityStatus',
      'owners',
      'tags',
      'domains',
      'updatedAt',
    ];

    const owner = { id: 'owner-id', type: 'user', name: 'alice' };

    const linkedMetric = {
      id: 'metric-id',
      name: 'net_sales',
      displayName: 'Net Sales',
      fullyQualifiedName: 'net_sales',
      tags: [
        {
          tagFQN: 'Business.Revenue',
          name: 'Revenue',
          source: 'Glossary',
          labelType: 'Manual',
          state: 'Confirmed',
        },
        {
          tagFQN: 'PII.Sensitive',
          name: 'Sensitive',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
      owners: [{ ...owner, displayName: 'Alice' }],
      domains: [
        {
          id: 'domain-id',
          type: 'domain',
          name: 'Finance',
          fullyQualifiedName: 'Finance',
        },
      ],
    };

    const renderWithAllColumns = async (
      metrics: Array<Record<string, unknown>>,
      awaitText: string
    ) => {
      localStorage.setItem(
        'metricsList.columnPrefs.v1',
        JSON.stringify(ALL_COLUMNS)
      );
      const { searchQuery } = require('../../../rest/searchAPI');
      searchQuery.mockResolvedValue(buildSearchResponse(metrics));

      renderPage();

      await screen.findByText(awaitText);
    };

    beforeEach(() => {
      const {
        usePermissionProvider,
      } = require('../../../context/PermissionProvider/PermissionProvider');
      usePermissionProvider.mockReturnValue({
        permissions: { metric: { ViewAll: true, ViewBasic: true } },
        getResourcePermission: jest
          .fn()
          .mockResolvedValue({ ViewAll: true, ViewBasic: true }),
      });
    });

    afterEach(() => localStorage.clear());

    it.each([
      ['domain', 'Finance', getDomainPath('Finance')],
      ['owner', 'Alice', getOwnerPath(owner as EntityReference)],
    ])('links the %s to its own page', async (_label, name, href) => {
      await renderWithAllColumns([linkedMetric], 'Net Sales');

      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    });

    it.each([
      ['glossary term', 'Business.Revenue'],
      ['classification tag', 'PII.Sensitive'],
      ['domain', 'Finance'],
      ['owner', 'Alice'],
    ])(
      'does not open the metric when the %s is clicked',
      async (_label, name) => {
        await renderWithAllColumns([linkedMetric], 'Net Sales');

        fireEvent.click(screen.getByRole('link', { name }));

        expect(mockNavigate).not.toHaveBeenCalled();
      }
    );

    it('opens the metric when nothing under the click handles it', async () => {
      await renderWithAllColumns(
        [
          {
            id: 'bare-id',
            name: 'bare_metric',
            fullyQualifiedName: 'bare_metric',
          },
        ],
        'bare_metric'
      );

      fireEvent.click(screen.getAllByText('label.empty-dash')[0]);

      expect(mockNavigate).toHaveBeenCalledWith(
        getEntityDetailsPath(EntityType.METRIC, 'bare_metric')
      );
    });

    it('leaves a domain without a fully qualified name unlinked', async () => {
      await renderWithAllColumns(
        [
          {
            ...linkedMetric,
            domains: [{ id: 'domain-id', type: 'domain', name: 'Finance' }],
          },
        ],
        'Net Sales'
      );

      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Finance' })).toBeNull();
    });
  });
});
