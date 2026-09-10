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

import { ToastProvider, toastQueue } from '@openmetadata/ui-core-components';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import {
  ColumnGridResponse,
  MetadataStatus,
} from '../../../generated/api/data/columnGridResponse';
import {
  createHttpTestServer,
  deferredResponse,
} from '../../../test/unit/HttpTestServer.utils';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import ColumnGrid from './ColumnGrid.component';

jest.unmock('../../../utils/ToastUtils');

const gridResponse = (
  name = 'customer_id',
  occurrenceCount = 1
): ColumnGridResponse => ({
  columns: [
    {
      columnName: name,
      hasVariations: false,
      metadataStatus: MetadataStatus.Missing,
      totalOccurrences: occurrenceCount,
      groups: [
        {
          groupId: `${name}-group`,
          occurrenceCount,
          metadataStatus: MetadataStatus.Missing,
          dataType: 'VARCHAR',
          tags: [],
          occurrences: Array.from({ length: occurrenceCount }, (_, index) => ({
            columnFQN: `service.db.schema.customers_${index}.${name}`,
            entityFQN: `service.db.schema.customers_${index}`,
            entityType: 'table',
            serviceName: 'service',
            databaseName: 'db',
            schemaName: 'schema',
          })),
        },
      ],
    },
  ],
  totalUniqueColumns: 1,
  totalOccurrences: occurrenceCount,
});

describe('Column grid with real controls, routing and HTTP requests', () => {
  let server: ReturnType<typeof createHttpTestServer>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    window.history.replaceState({}, '', '/column-bulk-operations');
    server = createHttpTestServer();
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    server.on('GET', '/api/v1/columns/grid', () => ({ data: gridResponse() }));
    server.on('GET', '/api/v1/search/query', () => ({
      data: { hits: { hits: [], total: { value: 0 } } },
    }));
    server.on('GET', '/api/v1/glossaries', () => ({
      data: { data: [], paging: { total: 0 } },
    }));
  });

  afterEach(async () => {
    cleanup();
    toastQueue.clear();
    await act(async () => jest.runOnlyPendingTimers());
    server.restore();
  });

  const renderGrid = async (query = '') => {
    window.history.replaceState({}, '', `/column-bulk-operations${query}`);
    await act(async () => {
      renderWithQueryClient(
        <BrowserRouter>
          <ColumnGrid />
          <ToastProvider />
        </BrowserRouter>
      );
    });
  };

  const searchFor = async (query: string) => {
    const search = screen.getByPlaceholderText('label.search-columns');
    await user.clear(search);
    await user.type(search, query);
    await act(async () => jest.advanceTimersByTime(300));
  };

  const lastGridRequest = () =>
    server.requests
      .filter(({ url }) => url.pathname === '/api/v1/columns/grid')
      .slice(-1)[0];

  const selectColumn = async (name = 'customer_id') => {
    const row = screen.getByRole('row', { name: new RegExp(name) });
    await user.click(within(row).getByRole('checkbox'));
  };

  const openEditor = async () => {
    await selectColumn();
    await user.click(screen.getByTestId('edit-button'));

    return screen.findByTestId('column-bulk-operations-form-drawer');
  };

  it('renders supplied columns and exact stats, with editing disabled until selection', async () => {
    await renderGrid();
    await waitFor(() => expect(server.requests).toHaveLength(1));

    expect(await screen.findByText('customer_id')).toBeVisible();
    expect(screen.getByTestId('total-unique-columns-value')).toHaveTextContent(
      '1'
    );
    expect(screen.getByTestId('total-occurrences-value')).toHaveTextContent(
      '1'
    );
    expect(screen.getByTestId('pending-changes-value')).toHaveTextContent('0');
    expect(screen.getByTestId('edit-button-disabled')).toBeDisabled();
  });

  it('renders an empty result after searching and sends the typed query to the server', async () => {
    server.on('GET', '/api/v1/columns/grid', ({ url }) => ({
      data: url.searchParams.has('columnNamePattern')
        ? { columns: [], totalUniqueColumns: 0, totalOccurrences: 0 }
        : gridResponse(),
    }));
    await renderGrid();
    await screen.findByText('customer_id');
    await user.type(
      screen.getByPlaceholderText('label.search-columns'),
      'nonexistent'
    );

    expect(
      await screen.findByText('label.no-matching-result-plural')
    ).toBeVisible();
    expect(screen.queryByText('customer_id')).not.toBeInTheDocument();
    expect(lastGridRequest().url.searchParams.get('columnNamePattern')).toBe(
      'nonexistent'
    );
    expect(new URLSearchParams(window.location.search).get('q')).toBe(
      'nonexistent'
    );
  });

  it.each([
    ['metadataStatus', 'INCONSISTENT', 'metadataStatus'],
    ['service.displayName.keyword', 'warehouse', 'serviceName'],
  ])(
    'restores the %s URL filter in the chip and HTTP request',
    async (field, value, apiField) => {
      await renderGrid(`?${field}=${value}`);

      expect(
        await screen.findByTestId(`filter-chip-${field}`)
      ).toHaveTextContent(value);
      expect(lastGridRequest().url.searchParams.get(apiField)).toBe(value);
      expect(screen.getByText('customer_id')).toBeVisible();
    }
  );

  it('applies and clears a metadata filter through the real dropdown, URL and request', async () => {
    await renderGrid();
    await user.click(
      screen.getByRole('button', { name: 'label.metadata-status' })
    );
    await user.click(screen.getByTestId('MISSING'));
    await user.click(screen.getByTestId('update-btn'));

    expect(
      await screen.findByTestId('filter-chip-metadataStatus')
    ).toHaveTextContent('MISSING');
    expect(lastGridRequest().url.searchParams.get('metadataStatus')).toBe(
      'MISSING'
    );
    expect(
      new URLSearchParams(window.location.search).get('metadataStatus')
    ).toBe('MISSING');

    await user.click(
      screen.getByRole('button', { name: /label.metadata-status/ })
    );
    await user.click(screen.getByTestId('MISSING'));
    await user.click(screen.getByTestId('update-btn'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('filter-chip-metadataStatus')
      ).not.toBeInTheDocument()
    );

    expect(lastGridRequest().url.searchParams.has('metadataStatus')).toBe(
      false
    );
    expect(
      new URLSearchParams(window.location.search).has('metadataStatus')
    ).toBe(false);
  });

  it('serializes the selected asset type and renders the filtered response', async () => {
    server.on('GET', '/api/v1/columns/grid', ({ url }) => ({
      data: gridResponse(
        url.searchParams.has('entityTypes') ? 'table_column' : 'customer_id'
      ),
    }));
    await renderGrid();
    await user.click(screen.getByRole('button', { name: 'label.asset-type' }));
    await user.click(screen.getByRole('checkbox', { name: 'Table' }));
    await user.click(screen.getByTestId('update-btn'));

    expect(await screen.findByText('table_column')).toBeVisible();
    expect(lastGridRequest().url.searchParams.get('entityTypes')).toBe('table');
    expect(screen.queryByText('customer_id')).not.toBeInTheDocument();
  });

  it('keeps previous totals while a search is pending, then renders the new totals', async () => {
    const pending = deferredResponse<{ data: ColumnGridResponse }>();
    server.on('GET', '/api/v1/columns/grid', ({ url }) =>
      url.searchParams.has('columnNamePattern')
        ? pending.promise
        : { data: gridResponse() }
    );
    await renderGrid();
    await searchFor('account');

    expect(lastGridRequest().url.searchParams.get('columnNamePattern')).toBe(
      'account'
    );
    expect(screen.getByTestId('total-unique-columns-value')).toHaveTextContent(
      '1'
    );
    expect(screen.getByTestId('total-occurrences-value')).toHaveTextContent(
      '1'
    );

    await act(async () =>
      pending.resolve({
        data: {
          ...gridResponse('account_id'),
          totalUniqueColumns: 7,
          totalOccurrences: 21,
        },
      })
    );

    expect(await screen.findByText('account_id')).toBeVisible();
    expect(screen.getByTestId('total-unique-columns-value')).toHaveTextContent(
      '7'
    );
    expect(screen.getByTestId('total-occurrences-value')).toHaveTextContent(
      '21'
    );
  });

  it('keeps the latest results and totals when an older search resolves last', async () => {
    const stale = deferredResponse<{ data: ColumnGridResponse }>();
    server.on('GET', '/api/v1/columns/grid', ({ url }) => {
      const query = url.searchParams.get('columnNamePattern');

      return query === 'stale'
        ? stale.promise
        : {
            data: gridResponse(
              query === 'fresh' ? 'fresh_column' : 'customer_id'
            ),
          };
    });
    await renderGrid();
    await searchFor('stale');

    expect(lastGridRequest().url.searchParams.get('columnNamePattern')).toBe(
      'stale'
    );

    await searchFor('fresh');

    expect(await screen.findByText('fresh_column')).toBeVisible();

    await act(async () =>
      stale.resolve({
        data: {
          ...gridResponse('stale_column'),
          totalUniqueColumns: 99,
          totalOccurrences: 99,
        },
      })
    );

    expect(screen.queryByText('stale_column')).not.toBeInTheDocument();
    expect(screen.getByText('fresh_column')).toBeVisible();
    expect(screen.getByTestId('total-unique-columns-value')).toHaveTextContent(
      /^1$/
    );
    expect(new URLSearchParams(window.location.search).get('q')).toBe('fresh');
  });

  it('cancels selection and disables editing without sending a mutation', async () => {
    await renderGrid();
    await selectColumn();

    expect(screen.getByTestId('edit-button')).toBeEnabled();

    await user.click(screen.getByTestId('cancel-selection-button'));

    expect(screen.getByTestId('edit-button-disabled')).toBeDisabled();
    expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(
      0
    );
    expect(server.requests.filter(({ method }) => method !== 'GET')).toEqual(
      []
    );
  });

  it('opens the real edit form with column identity, display name, description and tag controls', async () => {
    await renderGrid();
    const drawer = await openEditor();

    expect(
      within(drawer).getByTestId('column-name-input').querySelector('input')
    ).toHaveValue('customer_id');
    expect(
      within(drawer).getByTestId('display-name-input').querySelector('input')
    ).toHaveValue('');
    expect(within(drawer).getByTestId('description-field')).toBeVisible();
    expect(within(drawer).getByTestId('tags-field')).toBeVisible();
    expect(within(drawer).getByTestId('glossary-terms-field')).toBeVisible();
  });

  it('counts selected occurrences without counting the aggregate parent, and tracks pending edits', async () => {
    server.on('GET', '/api/v1/columns/grid', () => ({
      data: gridResponse('customer_id', 2),
    }));
    await renderGrid();
    const drawer = await openEditor();

    expect(within(drawer).getByTestId('form-heading')).toHaveTextContent('02');
    expect(
      within(within(drawer).getByTestId('column-name-input')).getByRole(
        'textbox'
      )
    ).toHaveValue('2 label.column-lowercase-plural label.selected-lowercase');

    await user.type(
      within(within(drawer).getByTestId('display-name-input')).getByRole(
        'textbox'
      ),
      'Customer'
    );
    await user.tab();

    expect(screen.getByTestId('pending-changes-value')).toHaveTextContent(
      '2/2'
    );
  });

  it('shows the number of independently selected columns in the drawer', async () => {
    server.on('GET', '/api/v1/columns/grid', () => ({
      data: {
        columns: [
          ...gridResponse().columns,
          ...gridResponse('account_id').columns,
        ],
        totalUniqueColumns: 2,
        totalOccurrences: 2,
      },
    }));
    await renderGrid();
    await selectColumn();
    await selectColumn('account_id');
    await user.click(screen.getByTestId('edit-button'));
    const drawer = await screen.findByTestId(
      'column-bulk-operations-form-drawer'
    );

    expect(within(drawer).getByTestId('form-heading')).toHaveTextContent('02');
    expect(
      within(within(drawer).getByTestId('column-name-input')).getByRole(
        'textbox'
      )
    ).toHaveValue('2 label.column-lowercase-plural label.selected-lowercase');
  });

  it('discards unsaved edits on cancel and reopens with the original value', async () => {
    await renderGrid();
    const drawer = await openEditor();
    await user.type(
      within(within(drawer).getByTestId('display-name-input')).getByRole(
        'textbox'
      ),
      'Temporary display name'
    );
    await user.tab();

    expect(screen.getByTestId('pending-changes-value')).toHaveTextContent(
      '1/1'
    );

    await user.click(within(drawer).getByTestId('cancel-btn'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('column-bulk-operations-form-drawer')
      ).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('pending-changes-value')).toHaveTextContent(
      /^0$/
    );

    await user.click(screen.getByTestId('edit-button'));
    const reopened = await screen.findByTestId(
      'column-bulk-operations-form-drawer'
    );

    expect(
      within(within(reopened).getByTestId('display-name-input')).getByRole(
        'textbox'
      )
    ).toHaveValue('');
    expect(server.requests.filter(({ method }) => method === 'POST')).toEqual(
      []
    );
  });

  it('opens the drawer by clicking the aggregate column name', async () => {
    server.on('GET', '/api/v1/columns/grid', () => ({
      data: gridResponse('customer_id', 2),
    }));
    await renderGrid();
    await user.click(screen.getByRole('button', { name: 'customer_id (2)' }));

    expect(
      await screen.findByTestId('column-bulk-operations-form-drawer')
    ).toBeVisible();
    expect(screen.getByTestId('form-heading')).toHaveTextContent('02');
  });

  it('submits exactly one update per selected occurrence and tracks the pending job', async () => {
    const submission = deferredResponse<{
      data: { jobId: string; message: string };
    }>();
    server.on('GET', '/api/v1/columns/grid', () => ({
      data: gridResponse('customer_id', 2),
    }));
    server.on(
      'POST',
      '/api/v1/columns/bulk-update-async',
      () => submission.promise
    );
    await renderGrid();
    const drawer = await openEditor();
    await user.type(
      within(within(drawer).getByTestId('display-name-input')).getByRole(
        'textbox'
      ),
      'Customer'
    );
    await user.click(within(drawer).getByTestId('save-btn'));
    await waitFor(() =>
      expect(
        server.requests.filter(({ method }) => method === 'POST')
      ).toHaveLength(1)
    );

    expect(
      server.requests.find(({ method }) => method === 'POST')?.body
    ).toEqual({
      columnUpdates: [
        {
          columnFQN: 'service.db.schema.customers_0.customer_id',
          entityType: 'table',
          displayName: 'Customer',
        },
        {
          columnFQN: 'service.db.schema.customers_1.customer_id',
          entityType: 'table',
          displayName: 'Customer',
        },
      ],
    });
    expect(
      within(screen.getByTestId('pending-changes-card')).getByTestId('loader')
    ).toBeVisible();

    await act(async () =>
      submission.resolve({ data: { jobId: 'bulk-job', message: 'accepted' } })
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('column-bulk-operations-form-drawer')
      ).not.toBeInTheDocument()
    );

    expect(
      within(screen.getByTestId('pending-changes-card')).getByTestId('loader')
    ).toBeVisible();
    expect(screen.getByTestId('pending-changes-value')).toHaveTextContent(
      '0/2'
    );
  });

  it('preserves edits and allows retry when submission fails', async () => {
    server.on('POST', '/api/v1/columns/bulk-update-async', () => ({
      status: 500,
      data: { message: 'temporary failure' },
    }));
    await renderGrid();
    const drawer = await openEditor();
    await user.type(
      within(within(drawer).getByTestId('display-name-input')).getByRole(
        'textbox'
      ),
      'Customer'
    );
    await user.click(within(drawer).getByTestId('save-btn'));
    await waitFor(() =>
      expect(within(drawer).getByTestId('save-btn')).toBeEnabled()
    );

    expect(
      within(within(drawer).getByTestId('display-name-input')).getByRole(
        'textbox'
      )
    ).toHaveValue('Customer');
    expect(
      within(screen.getByTestId('pending-changes-card')).queryByTestId('loader')
    ).not.toBeInTheDocument();
    expect(
      server.requests.filter(({ method }) => method === 'POST')
    ).toHaveLength(1);
    expect(
      await screen.findByText('server.entity-updating-error')
    ).toBeVisible();

    server.on('POST', '/api/v1/columns/bulk-update-async', () => ({
      data: { jobId: 'retry-job', message: 'accepted' },
    }));
    await user.click(within(drawer).getByTestId('save-btn'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('column-bulk-operations-form-drawer')
      ).not.toBeInTheDocument()
    );
    const submissions = server.requests.filter(
      ({ method }) => method === 'POST'
    );

    expect(submissions).toHaveLength(2);
    expect(submissions[1].body).toEqual(submissions[0].body);
  });

  it('uses the cursor for the next page, preserves global totals, and resets it for a new search', async () => {
    server.on('GET', '/api/v1/columns/grid', ({ url }) => ({
      data: url.searchParams.has('cursor')
        ? { ...gridResponse('second_page_column'), totalUniqueColumns: 1 }
        : {
            ...gridResponse(
              url.searchParams.has('columnNamePattern')
                ? 'search_column'
                : 'customer_id'
            ),
            totalUniqueColumns: 26,
            totalOccurrences: 26,
            cursor: 'next-cursor',
          },
    }));
    await renderGrid();

    expect(screen.getByTestId('previous')).toBeDisabled();
    expect(screen.getByTestId('next')).toBeEnabled();

    await user.click(screen.getByTestId('next'));
    await waitFor(() =>
      expect(lastGridRequest().url.searchParams.get('cursor')).toBe(
        'next-cursor'
      )
    );

    expect(await screen.findByText('second_page_column')).toBeVisible();
    expect(screen.queryByText('customer_id')).not.toBeInTheDocument();
    expect(lastGridRequest().url.searchParams.get('cursor')).toBe(
      'next-cursor'
    );
    expect(screen.getByTestId('total-unique-columns-value')).toHaveTextContent(
      '26'
    );
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'label.page 2 label.of 2'
    );

    await user.click(screen.getByTestId('previous'));

    expect(await screen.findByText('customer_id')).toBeVisible();

    await user.click(screen.getByTestId('next'));

    expect(await screen.findByText('second_page_column')).toBeVisible();

    await searchFor('search');

    expect(await screen.findByText('search_column')).toBeVisible();
    expect(lastGridRequest().url.searchParams.has('cursor')).toBe(false);
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'label.page 1'
    );
  });

  it('expands nested STRUCT rows and opens the edit form for the exact child', async () => {
    const response = gridResponse('address');
    response.columns[0].groups[0].dataType = 'STRUCT';
    response.columns[0].groups[0].children = [
      {
        name: 'city',
        dataType: 'VARCHAR',
        fullyQualifiedName: 'service.db.schema.customers_0.address.city',
      },
    ];
    server.on('GET', '/api/v1/columns/grid', () => ({ data: response }));
    await renderGrid();

    expect(screen.queryByText('city')).not.toBeInTheDocument();

    const structRow = screen.getByTestId('column-row-address');
    await user.click(within(structRow).getAllByRole('button')[0]);

    expect(await screen.findByText('city')).toBeVisible();

    const childRow = screen.getByRole('row', { name: /city/ });
    await user.click(within(childRow).getByRole('checkbox'));
    await user.click(screen.getByTestId('edit-button'));
    const drawer = await screen.findByTestId(
      'column-bulk-operations-form-drawer'
    );

    expect(
      within(within(drawer).getByTestId('column-name-input')).getByRole(
        'textbox'
      )
    ).toHaveValue('city');
    expect(
      within(within(drawer).getByTestId('display-name-input')).getByRole(
        'textbox'
      )
    ).toBeEnabled();
  });

  it('rejects an unchanged submission without scheduling a bulk job', async () => {
    await renderGrid();
    const drawer = await openEditor();
    await user.click(within(drawer).getByTestId('save-btn'));

    expect(await screen.findByText('message.no-changes-to-save')).toBeVisible();
    expect(server.requests.filter(({ method }) => method === 'POST')).toEqual(
      []
    );
    expect(drawer).toBeVisible();
  });
});
