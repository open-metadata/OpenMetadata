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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Task } from '../../../rest/tasksAPI';
import TaskListV1 from './TaskListV1.component';

const mockGetTaskById = jest.fn();

jest.mock('../../../rest/tasksAPI', () => ({
  getTaskById: (...args: unknown[]) => mockGetTaskById(...args),
}));

jest.mock('../TaskFeedCard/TaskFeedCardFromTask.component', () =>
  jest.fn(
    ({
      task,
      onTaskClick,
    }: {
      task: { id: string };
      onTaskClick: (task: { id: string }) => void;
    }) => (
      <button data-testid={`card-${task.id}`} onClick={() => onTaskClick(task)}>
        {task.id}
      </button>
    )
  )
);

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

const tasks = [{ id: 'first' }, { id: 'request' }] as Task[];

const renderList = (search: string, selectedTask?: Task) => {
  const onTaskClick = jest.fn();
  const view = render(
    <MemoryRouter
      initialEntries={[`/dataProduct/Sales/activity_feed/tasks${search}`]}>
      <TaskListV1
        emptyPlaceholderText=""
        isLoading={false}
        selectedTask={selectedTask}
        taskList={tasks}
        onTaskClick={onTaskClick}
      />
    </MemoryRouter>
  );

  return { ...view, onTaskClick };
};

describe('TaskListV1', () => {
  it('opens the first task when the link names none', () => {
    const { onTaskClick } = renderList('');

    expect(onTaskClick).toHaveBeenCalledWith(tasks[0]);
  });

  it('opens the task the link names', () => {
    const { onTaskClick } = renderList('?taskId=request');

    expect(onTaskClick).toHaveBeenCalledWith(tasks[1]);
    expect(onTaskClick).not.toHaveBeenCalledWith(tasks[0]);
  });

  it('opens the linked task over one already selected on the page', () => {
    const { onTaskClick } = renderList('?taskId=request', tasks[0]);

    expect(onTaskClick).toHaveBeenCalledWith(tasks[1]);
  });

  it('keeps a later pick once the linked task has been opened', () => {
    const { onTaskClick, rerender } = renderList('?taskId=request', tasks[1]);
    onTaskClick.mockClear();

    rerender(
      <MemoryRouter
        initialEntries={[
          '/dataProduct/Sales/activity_feed/tasks?taskId=request',
        ]}>
        <TaskListV1
          emptyPlaceholderText=""
          isLoading={false}
          selectedTask={tasks[0]}
          taskList={tasks}
          onTaskClick={onTaskClick}
        />
      </MemoryRouter>
    );

    expect(onTaskClick).not.toHaveBeenCalled();
  });

  it('loads the linked task when it is not on the loaded page, and keeps it open', async () => {
    const offPage = { id: 'off-page' } as Task;
    mockGetTaskById.mockResolvedValueOnce({ data: offPage });
    const { onTaskClick, rerender } = renderList('?taskId=off-page');

    await waitFor(() => expect(onTaskClick).toHaveBeenLastCalledWith(offPage));

    onTaskClick.mockClear();
    rerender(
      <MemoryRouter
        initialEntries={[
          '/dataProduct/Sales/activity_feed/tasks?taskId=off-page',
        ]}>
        <TaskListV1
          emptyPlaceholderText=""
          isLoading={false}
          selectedTask={offPage}
          taskList={tasks}
          onTaskClick={onTaskClick}
        />
      </MemoryRouter>
    );

    expect(onTaskClick).not.toHaveBeenCalled();
  });

  it('falls back to the first task when the linked one cannot be loaded', async () => {
    mockGetTaskById.mockRejectedValueOnce(new Error('Not found'));
    const { onTaskClick } = renderList('?taskId=missing');

    await waitFor(() => expect(onTaskClick).toHaveBeenLastCalledWith(tasks[0]));
  });

  it('does not reopen the linked task when a later page brings it in', () => {
    mockGetTaskById.mockReturnValueOnce(new Promise(() => undefined));
    const { onTaskClick, rerender } = renderList(
      '?taskId=request-late',
      tasks[0]
    );
    onTaskClick.mockClear();
    const late = { id: 'request-late' } as Task;

    rerender(
      <MemoryRouter
        initialEntries={[
          '/dataProduct/Sales/activity_feed/tasks?taskId=request-late',
        ]}>
        <TaskListV1
          emptyPlaceholderText=""
          isLoading={false}
          selectedTask={tasks[0]}
          taskList={[...tasks, late]}
          onTaskClick={onTaskClick}
        />
      </MemoryRouter>
    );

    expect(onTaskClick).not.toHaveBeenCalledWith(late);
  });

  it('drops a late linked task once the user has picked another', async () => {
    const pending = deferred<{ data: Task }>();
    mockGetTaskById.mockReturnValueOnce(pending.promise);
    const { onTaskClick } = renderList('?taskId=off-page');

    fireEvent.click(screen.getByTestId('card-request'));

    expect(onTaskClick).toHaveBeenLastCalledWith(tasks[1]);

    await act(async () => {
      pending.resolve({ data: { id: 'off-page' } as Task });
      await pending.promise;
    });

    expect(onTaskClick).not.toHaveBeenCalledWith({ id: 'off-page' });
    expect(onTaskClick).toHaveBeenLastCalledWith(tasks[1]);
  });

  it('drops a linked task that arrives after the list has gone', async () => {
    const pending = deferred<{ data: Task }>();
    mockGetTaskById.mockReturnValueOnce(pending.promise);
    const { onTaskClick, unmount } = renderList('?taskId=off-page');

    unmount();
    await act(async () => {
      pending.resolve({ data: { id: 'off-page' } as Task });
      await pending.promise;
    });

    expect(onTaskClick).not.toHaveBeenCalled();
  });
});
