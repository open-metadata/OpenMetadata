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

import { act, renderHook, waitFor } from '@testing-library/react';
import { Column } from '../../generated/entity/data/table';
import { getTableColumnsById } from '../../rest/tableAPI';
import { useKnowledgeGraphColumns } from './useKnowledgeGraphColumns';

jest.mock('../../rest/tableAPI', () => ({ getTableColumnsById: jest.fn() }));
const fetchColumns = getTableColumnsById as jest.MockedFunction<
  typeof getTableColumnsById
>;
const column = (name: string) => ({ name, dataType: 'STRING' } as Column);

beforeEach(() => fetchColumns.mockReset());

it('keeps a bounded first page and loads the remaining columns on demand', async () => {
  const columns = Array.from({ length: 1001 }, (_, index) =>
    column('column_' + index)
  );
  fetchColumns.mockImplementation(async (_id, params) => ({
    data: columns.slice(params?.offset ?? 0, (params?.offset ?? 0) + 1000),
    paging: { total: columns.length },
  }));
  const { result } = renderHook(() =>
    useKnowledgeGraphColumns('table', true, 0)
  );
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.columns).toHaveLength(1000);
  expect(result.current.total).toBe(1001);

  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.columns).toHaveLength(1001));

  expect(result.current.columns[1000].name).toBe('column_1000');
});

it('ignores a superseded table response and retains the current columns after a failed refresh', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof getTableColumnsById>>
  ) => void;
  let oldSignal: AbortSignal | undefined;
  fetchColumns
    .mockImplementationOnce((_id, _params, signal) => {
      oldSignal = signal;

      return new Promise((done) => {
        resolve = done;
      });
    })
    .mockResolvedValueOnce({ data: [column('current')], paging: { total: 1 } });
  const { result, rerender } = renderHook(
    ({ id, refresh }) => useKnowledgeGraphColumns(id, true, refresh),
    { initialProps: { id: 'old', refresh: 0 } }
  );
  rerender({ id: 'current', refresh: 0 });
  await waitFor(() => expect(result.current.columns[0]?.name).toBe('current'));

  expect(oldSignal?.aborted).toBe(true);

  await act(async () =>
    resolve({ data: [column('stale')], paging: { total: 1 } })
  );

  expect(result.current.columns[0].name).toBe('current');

  fetchColumns.mockRejectedValueOnce(new Error('Unavailable'));
  rerender({ id: 'current', refresh: 1 });
  await waitFor(() =>
    expect(result.current.error).toEqual(new Error('Unavailable'))
  );

  expect(result.current.columns[0].name).toBe('current');
});
