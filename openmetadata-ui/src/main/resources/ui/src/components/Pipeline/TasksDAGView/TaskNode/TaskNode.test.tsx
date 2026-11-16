/*
 *  Copyright 2023 Collate.
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
import { NodeProps } from 'reactflow';
import TaskNode from './TaskNode';

jest.mock('reactflow', () => ({
  ...jest.requireActual('reactflow'),
  Handle: jest.fn().mockImplementation(() => <div>Handle</div>),
}));

const mockProps = {
  data: {
    label: 'Test Label',
    taskStatus: 'Successful',
  },
} as NodeProps;

describe('TaskNode', () => {
  it('component should render', async () => {
    render(<TaskNode {...mockProps} />);

    expect(
      await screen.findByTestId('task-node-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('node-label')).toBeInTheDocument();
    expect(await screen.findByTestId('node-label-status')).toBeInTheDocument();
  });

  it('should render correct label', async () => {
    render(<TaskNode {...mockProps} />);

    expect(await screen.findByText(mockProps.data.label)).toBeInTheDocument();
  });

  it.each([
    ['Successful', 'tw:bg-visualization-green-3'],
    ['Failed', 'tw:bg-visualization-red-3'],
    ['Pending', 'tw:bg-visualization-yellow-2'],
  ])(
    'colours the status dot for %s with a theme token',
    async (taskStatus, tokenClass) => {
      render(
        <TaskNode {...mockProps} data={{ ...mockProps.data, taskStatus }} />
      );

      expect(await screen.findByTestId('node-label-status')).toHaveClass(
        'tw:size-2.5',
        'tw:rounded-full',
        tokenClass
      );
    }
  );

  it('uses theme surface and text tokens on the node', async () => {
    render(<TaskNode {...mockProps} />);

    expect(await screen.findByTestId('task-node-container')).toHaveClass(
      'tw:bg-surface',
      'tw:text-primary'
    );
  });
});
