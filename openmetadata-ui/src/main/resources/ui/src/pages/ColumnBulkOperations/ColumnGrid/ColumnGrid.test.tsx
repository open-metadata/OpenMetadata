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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SOCKET_EVENTS } from '../../../constants/constants';
import { ColumnGridResponse } from '../../../generated/api/data/columnGridResponse';
import {
  bulkUpdateColumnsAsync,
  CSVImportResponse,
  getColumnGrid,
} from '../../../rest/columnAPI';
import { showSuccessToast } from '../../../utils/ToastUtils';
import ColumnGrid from './ColumnGrid.component';
import { MAX_EARLY_SOCKET_MESSAGES } from './constants/ColumnGrid.constants';

jest.mock('../../../rest/columnAPI', () => ({
  getColumnGrid: jest.fn(),
  bulkUpdateColumnsAsync: jest.fn(),
}));

const socketHandlers: Record<string, (message: string) => void> = {};
const mockSocket = {
  on: (event: string, handler: (message: string) => void) => {
    socketHandlers[event] = handler;
  },
  off: jest.fn(),
};

jest.mock('../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn(() => ({ socket: mockSocket })),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetColumnGrid = getColumnGrid as jest.MockedFunction<
  typeof getColumnGrid
>;
const mockBulkUpdateColumnsAsync =
  bulkUpdateColumnsAsync as jest.MockedFunction<typeof bulkUpdateColumnsAsync>;

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

describe('ColumnGrid bulk update', () => {
  const submitBulkUpdate = async () => {
    mockGetColumnGrid.mockResolvedValue(GRID_RESPONSE);
    const updateRequest = deferred<CSVImportResponse>();
    mockBulkUpdateColumnsAsync.mockReturnValue(updateRequest.promise);

    renderGrid();

    const row = await screen.findByTestId('column-row-customer_id');
    fireEvent.click(row.querySelector('[slot="selection"] input') as Element);
    fireEvent.click(screen.getByTestId('edit-button'));
    fireEvent.change(
      screen
        .getByTestId('display-name-input')
        .querySelector('input') as Element,
      { target: { value: 'Customer' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.update' }));

    return updateRequest;
  };

  const emitSocketMessage = (jobId: string, status: string) =>
    socketHandlers[SOCKET_EVENTS.BULK_ASSETS_CHANNEL](
      JSON.stringify({ jobId, status })
    );

  beforeEach(() => {
    jest.mocked(showSuccessToast).mockClear();
  });

  it('shows the success toast when the job completes before the update request returns', async () => {
    const updateRequest = await submitBulkUpdate();

    await act(async () => {
      emitSocketMessage('job-1', 'COMPLETED');
      updateRequest.resolve({ jobId: 'job-1', message: '' });
    });

    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.bulk-update-initiated'
    );
  });

  it('keeps an early completion when another job floods the buffer', async () => {
    const updateRequest = await submitBulkUpdate();

    await act(async () => {
      emitSocketMessage('job-1', 'COMPLETED');
      for (let i = 0; i < MAX_EARLY_SOCKET_MESSAGES; i++) {
        emitSocketMessage('job-2', 'IN_PROGRESS');
      }
      updateRequest.resolve({ jobId: 'job-1', message: '' });
    });

    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.bulk-update-initiated'
    );
  });
});
