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
import { MemoryRouter } from 'react-router-dom';
import { EdgeProps, Position } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import { LineageLayer } from '../../../generated/settings/settings';
import { CustomEdge } from './CustomEdge.component';

jest.mock('../../../constants/Lineage.constants', () => ({
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
    isColumnLineage: false,
    selectedNode: {
      id: 'node1',
    },
    edge: {
      fromEntity: {
        id: '1',
        fullyQualifiedName: 'table1',
        type: 'table',
      },
      toEntity: {
        id: '2',
        fullyQualifiedName: 'table2',
        type: 'table',
      },
      pipeline: {
        id: 'pipeline1',
        fullyQualifiedName: 'pipeline1',
        type: 'pipeline',
        name: 'pipeline1',
      },
    },
    isEditMode: true,
  },
  selected: true,
} as EdgeProps;

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    tracedNodes: [],
    tracedColumns: [],
    pipelineStatus: {},
    activeLayer: [LineageLayer.ColumnLevelLineage],
    fetchPipelineStatus: jest.fn(),
  })),
}));

describe('Test CustomEdge Component', () => {
  it('Check if CustomEdge has selected as false', async () => {
    render(<CustomEdge {...mockCustomEdgeProp} selected={false} />, {
      wrapper: MemoryRouter,
    });

    const deleteButton = screen.queryByTestId('delete-button');

    expect(deleteButton).not.toBeInTheDocument();
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

    const pipelineLabelAsEdge = await screen.findByTestId(
      'pipeline-label-table1-table2'
    );

    expect(pipelineLabelAsEdge).toBeInTheDocument();
  });
});
