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

import { findByTestId, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasksDAGView from './TasksDAGView';

const mockNodes = [
  {
    className: 'leaf-node Success',
    data: { label: 'Task 1' },
    id: 'task1',
    position: { x: 0, y: 0 },
    sourcePosition: 'right',
    targetPosition: 'left',
    type: 'input',
  },
  {
    className: 'leaf-node Failed',
    data: { label: 'Task 2' },
    id: 'task2',
    position: { x: 450, y: 0 },
    sourcePosition: 'right',
    targetPosition: 'left',
    type: 'output',
  },
];

const mockEdges = [
  {
    id: 'task1-task2',
    markerEnd: {
      type: 'arrowclosed',
    },
    source: 'task1',
    target: 'task2',
    type: 'custom',
  },
];

const tasks = [
  {
    name: 'task1',
  },
  {
    name: 'task2',
  },
];

const TasksDAGViewProps = {
  tasks,
};

jest.mock('../../../utils/EntityLineageUtils', () => ({
  dragHandle: jest.fn(),
  getLayoutedElements: jest.fn().mockImplementation(() => ({
    node: mockNodes,
    edge: mockEdges,
  })),
  getModalBodyText: jest.fn(),
  onLoad: jest.fn(),
  onNodeContextMenu: jest.fn(),
  onNodeMouseEnter: jest.fn(),
  onNodeMouseLeave: jest.fn(),
  onNodeMouseMove: jest.fn(),
}));

describe('Test PipelineDetails component', () => {
  it('Checks if the PipelineDetails component has all the proper components rendered', async () => {
    const { container } = render(<TasksDAGView {...TasksDAGViewProps} />, {
      wrapper: MemoryRouter,
    });
    const reactFlowElement = await findByTestId(container, 'rf__wrapper');

    expect(reactFlowElement).toBeInTheDocument();
  });
});
