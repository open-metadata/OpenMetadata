/*
 *  Copyright 2022 Collate.
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
import React from 'react';
import { act } from 'react-test-renderer';
import { ThreadTaskStatus } from '../../../generated/entity/feed/thread';
import TaskStatus from './TaskStatus';

const mockProps = {
  status: ThreadTaskStatus.Open,
};

describe('Test Task Status Component', () => {
  it('Should render the component', async () => {
    render(<TaskStatus {...mockProps} />);

    await act(async () => {
      const taskStatus = await screen.findByTestId('task-status');

      const taskStatusBadge = await screen.findByTestId('task-status-badge');
      const taskStatusText = await screen.findByTestId('task-status-text');

      expect(taskStatus).toBeInTheDocument();
      expect(taskStatusBadge).toBeInTheDocument();
      expect(taskStatusText).toBeInTheDocument();
    });
  });

  it('Should have relavent class name for open status', async () => {
    render(<TaskStatus {...mockProps} />);

    const taskStatus = await screen.findByTestId('task-status');

    const taskStatusBadge = await screen.findByTestId('task-status-badge');
    const taskStatusText = await screen.findByTestId('task-status-text');

    expect(taskStatus).toHaveClass('tw-bg-task-status-bg');

    expect(taskStatusBadge).toHaveClass('tw-bg-task-status-fg');

    expect(taskStatusText).toHaveClass('tw-text-task-status-fg');
  });

  it('Should have relavent class name for closed status', async () => {
    render(<TaskStatus {...mockProps} status={ThreadTaskStatus.Closed} />);

    const taskStatus = await screen.findByTestId('task-status');

    const taskStatusBadge = await screen.findByTestId('task-status-badge');
    const taskStatusText = await screen.findByTestId('task-status-text');

    expect(taskStatus).toHaveClass('tw-bg-gray-100');

    expect(taskStatusBadge).toHaveClass('tw-bg-gray-500');

    expect(taskStatusText).toHaveClass('tw-text-gray-500');
  });
});
