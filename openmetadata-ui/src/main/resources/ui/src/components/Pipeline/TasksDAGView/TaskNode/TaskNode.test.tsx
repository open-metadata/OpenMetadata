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
    taskStatus: 'Success',
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

  it('should append class based on status', async () => {
    render(<TaskNode {...mockProps} />);
    const status = await screen.findByTestId('node-label-status');

    expect(status).toHaveClass(mockProps.data.taskStatus);
  });
});
