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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { TASK_STATUS_COUNTS_QUERY_KEY } from '../../inbox.constants';
import TaskDetailPage from './TaskDetailPage';

jest.mock('./TaskDetailPanel', () => ({
  __esModule: true,
  default: ({
    taskId,
    onResolved,
  }: {
    taskId: string;
    onResolved: () => void;
  }) => (
    <div data-testid="task-detail-panel">
      <span>{taskId}</span>
      <button data-testid="resolve" onClick={onResolved}>
        resolve
      </button>
    </div>
  ),
}));

const renderPage = (onTaskChanged = jest.fn()) => {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <TaskDetailPage taskId="task-1" onTaskChanged={onTaskChanged} />
    </QueryClientProvider>
  );

  return { invalidate, onTaskChanged };
};

describe('TaskDetailPage', () => {
  it('renders the task in the detail panel', () => {
    renderPage();

    expect(screen.getByTestId('task-detail-page')).toBeInTheDocument();
    expect(screen.getByTestId('task-detail-panel')).toHaveTextContent('task-1');
  });

  it('marks the cached task counts stale and reports a change', () => {
    const { invalidate, onTaskChanged } = renderPage();

    fireEvent.click(screen.getByTestId('resolve'));

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [TASK_STATUS_COUNTS_QUERY_KEY],
    });
    expect(onTaskChanged).toHaveBeenCalled();
  });
});
