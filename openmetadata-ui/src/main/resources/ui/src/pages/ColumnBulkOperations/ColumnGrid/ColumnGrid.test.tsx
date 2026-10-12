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
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ColumnGridResponse } from '../../../generated/api/data/columnGridResponse';
import { getColumnGrid } from '../../../rest/columnAPI';
import ColumnGrid from './ColumnGrid.component';

jest.mock('../../../rest/columnAPI', () => ({
  getColumnGrid: jest.fn(),
  bulkUpdateColumnsAsync: jest.fn(),
}));

jest.mock('../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn(() => ({ socket: undefined })),
}));

const mockGetColumnGrid = getColumnGrid as jest.MockedFunction<
  typeof getColumnGrid
>;

const GRID_RESPONSE: ColumnGridResponse = {
  columns: [
    {
      columnName: 'customer_id',
      hasVariations: false,
      totalOccurrences: 1,
      groups: [
        {
          groupId: 'customer_id-group',
          dataType: 'INT',
          occurrenceCount: 1,
          occurrences: [
            {
              columnFQN: 'svc.db.schema.orders.customer_id',
              entityFQN: 'svc.db.schema.orders',
              entityType: 'table',
            },
          ],
        },
      ],
    },
  ],
  totalOccurrences: 1,
  totalUniqueColumns: 1,
};

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const renderGrid = () =>
  render(
    <MemoryRouter>
      <ColumnGrid />
    </MemoryRouter>
  );

describe('ColumnGrid loading and empty states', () => {
  it('overlays the loader on a mounted table while the grid request is in flight', async () => {
    const request = deferred<ColumnGridResponse>();
    mockGetColumnGrid.mockReturnValue(request.promise);

    renderGrid();

    expect(await screen.findByTestId('column-grid-loader')).toBeInTheDocument();
    expect(screen.getByTestId('table-view-container')).toBeInTheDocument();
    expect(
      screen.queryByTestId('column-grid-empty-placeholder')
    ).not.toBeInTheDocument();

    await act(async () => {
      request.resolve(GRID_RESPONSE);
    });

    expect(screen.queryByTestId('column-grid-loader')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-view-container')).toHaveTextContent(
      'customer_id'
    );
  });

  it('shows the empty placeholder instead of the table when the grid has no columns', async () => {
    mockGetColumnGrid.mockResolvedValue({
      columns: [],
      totalOccurrences: 0,
      totalUniqueColumns: 0,
    });

    renderGrid();

    expect(
      await screen.findByTestId('column-grid-empty-placeholder')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('table-view-container')
    ).not.toBeInTheDocument();
  });
});
