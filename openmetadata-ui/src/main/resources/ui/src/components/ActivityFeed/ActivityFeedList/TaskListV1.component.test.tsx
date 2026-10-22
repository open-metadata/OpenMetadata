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

import { render, screen } from '@testing-library/react';
import TaskListV1 from './TaskListV1.component';

jest.mock('../TaskFeedCard/TaskFeedCardFromTask.component', () =>
  jest.fn(() => <div data-testid="task-card" />)
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="task-loader" />)
);

describe('TaskListV1', () => {
  it('renders the empty state without the auto-margin placeholder class', () => {
    render(
      <TaskListV1
        emptyPlaceholderText="No tasks"
        isLoading={false}
        taskList={[]}
      />
    );

    expect(screen.getByText('No tasks')).toBeInTheDocument();
    // Its `margin: auto` shrinks the container to its padding inside the
    // flex-column feed panel, wrapping the message one word per line.
    expect(screen.getByTestId('no-data-placeholder-container')).not.toHaveClass(
      'no-data-placeholder-container'
    );
  });
});
