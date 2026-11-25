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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Task } from '../../../rest/tasksAPI';
import TaskListV1 from './TaskListV1.component';

jest.mock('../TaskFeedCard/TaskFeedCardFromTask.component', () =>
  jest.fn(() => <div />)
);

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

  it('falls back to the first task when the linked one is not listed', () => {
    const { onTaskClick } = renderList('?taskId=missing');

    expect(onTaskClick).toHaveBeenCalledWith(tasks[0]);
  });
});
