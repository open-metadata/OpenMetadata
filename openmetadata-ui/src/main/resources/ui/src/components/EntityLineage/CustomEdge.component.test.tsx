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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { EdgeProps, Position } from 'react-flow-renderer';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import { CustomEdge } from './CustomEdge.component';

jest.mock('../../constants/Lineage.constants', () => ({
  foreignObjectSize: 40,
}));

const mockCustomEdgeProp = {
  id: 'id1',
  sourceX: 20,
  sourceY: 20,
  targetX: 20,
  targetY: 20,
  sourcePosition: Position.Left,
  targetPosition: Position.Right,
  style: {},
  markerEnd: '',
  data: {
    source: 'node1',
    target: 'node2',
    sourceType: EntityType.TABLE,
    targetType: EntityType.DASHBOARD,
    onEdgeClick: jest.fn(),
    selectedNode: {
      id: 'node1',
    },
    isColumnLineage: false,
    isEditMode: true,
  },
  selected: true,
} as EdgeProps;

describe('Test CustomEdge Component', () => {
  it('Check if CustomEdge has all child elements', async () => {
    render(<CustomEdge {...mockCustomEdgeProp} />, {
      wrapper: MemoryRouter,
    });

    const deleteButton = await screen.findByTestId('delete-button');
    const edgePathElement = await screen.findAllByTestId(
      'react-flow-edge-path'
    );
    const pipelineLabelAsEdge = screen.queryByTestId('pipeline-label');

    expect(deleteButton).toBeInTheDocument();
    expect(pipelineLabelAsEdge).not.toBeInTheDocument();
    expect(edgePathElement).toHaveLength(edgePathElement.length);
  });

  it('Check if CustomEdge has selected as false', async () => {
    render(<CustomEdge {...mockCustomEdgeProp} selected={false} />, {
      wrapper: MemoryRouter,
    });

    const edgePathElement = await screen.findAllByTestId(
      'react-flow-edge-path'
    );

    const deleteButton = screen.queryByTestId('delete-button');

    expect(deleteButton).not.toBeInTheDocument();
    expect(edgePathElement).toHaveLength(edgePathElement.length);
  });

  it('Pipeline as edge should be visible', async () => {
    render(
      <CustomEdge
        {...mockCustomEdgeProp}
        data={{
          ...mockCustomEdgeProp.data,
          targetType: EntityType.TABLE,
          label: 'Pipeline',
          pipeline: {
            id: 'pipeline1',
            type: 'pipeline-id',
          },
        }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const pipelineLabelAsEdge = await screen.findByTestId('pipeline-label');
    const pipelineName = await screen.findByTestId('pipeline-name');

    expect(pipelineLabelAsEdge).toBeInTheDocument();
    expect(pipelineName).toBeInTheDocument();
    expect(pipelineName.textContent).toEqual('Pipeline');
  });
});
