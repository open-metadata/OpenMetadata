/*
 *  Copyright 2021 Collate
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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TasksDAGView from './TasksDAGView';

/**
 * mock implementation of ResizeObserver
 */
window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

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
  selectedExec: {},
  tasks,
};

jest.mock('../../utils/EntityLineageUtils', () => ({
  dragHandle: jest.fn(),
  getDataLabel: jest
    .fn()
    .mockReturnValue(<span data-testid="lineage-entity">datalabel</span>),
  getDeletedLineagePlaceholder: jest
    .fn()
    .mockReturnValue(<p>Task data is not available for deleted entities.</p>),
  getHeaderLabel: jest.fn().mockReturnValue(<p>Header label</p>),
  getLayoutedElementsV1: jest.fn().mockImplementation(() => ({
    node: mockNodes,
    edge: mockEdges,
  })),
  getLineageDataV1: jest.fn().mockReturnValue([]),
  getModalBodyText: jest.fn(),
  onLoad: jest.fn(),
  onNodeContextMenu: jest.fn(),
  onNodeMouseEnter: jest.fn(),
  onNodeMouseLeave: jest.fn(),
  onNodeMouseMove: jest.fn(),
  getUniqueFlowElements: jest.fn().mockReturnValue([]),
}));

describe('Test PipelineDetails component', () => {
  it('Checks if the PipelineDetails component has all the proper components rendered', async () => {
    const { container } = render(<TasksDAGView {...TasksDAGViewProps} />, {
      wrapper: MemoryRouter,
    });
    const reactFlowElement = await findByTestId(
      container,
      'react-flow-component'
    );

    expect(reactFlowElement).toBeInTheDocument();
  });
});
