/*
 *  Copyright 2024 Collate.
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
import { ReactFlowProvider } from 'reactflow';
import { ModelType } from '../../../generated/entity/data/table';
import { LineageLayer } from '../../../generated/settings/settings';
import CustomNodeV1Component from './CustomNodeV1.component';

const mockNodeDataProps = {
  id: 'node1',
  type: 'table',
  data: {
    node: {
      fullyQualifiedName: 'dim_customer',
      type: 'table',
      entityType: 'table',
      id: 'khjahjfja',
      columns: [
        { fullyQualifiedName: 'col1', name: 'col1' },
        { fullyQualifiedName: 'col2', name: 'col2' },
        { fullyQualifiedName: 'col3', name: 'col3' },
      ],
    },
  },
  selected: false,
  isConnectable: false,
  xPos: 0,
  yPos: 0,
  dragging: true,
  zIndex: 0,
};

const mockNodeDataProps2 = {
  id: 'node1',
  type: 'table',
  data: {
    node: {
      fullyQualifiedName: 'dim_customer',
      type: 'table',
      entityType: 'table',
      id: 'khjahjfja',
      columns: [
        { fullyQualifiedName: 'col1', name: 'col1' },
        { fullyQualifiedName: 'col2', name: 'col2' },
        { fullyQualifiedName: 'col3', name: 'col3' },
      ],
      dataModel: {
        modelType: ModelType.Dbt,
      },
    },
  },
  selected: false,
  isConnectable: false,
  xPos: 0,
  yPos: 0,
  dragging: true,
  zIndex: 0,
};

const onMockColumnClick = jest.fn();

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => ({
    tracedNodes: [],
    tracedColumns: [],
    pipelineStatus: {},
    nodes: [
      {
        mockNodeDataProps,
      },
    ],
    upstreamDownstreamData: {
      upstreamNodes: [],
      downstreamNodes: [],
      upstreamEdges: [],
      downstreamEdges: [],
    },
    columnsHavingLineage: [],
    activeLayer: [LineageLayer.ColumnLevelLineage],
    fetchPipelineStatus: jest.fn(),
    onColumnClick: onMockColumnClick,
  })),
}));

describe('CustomNodeV1', () => {
  it('renders node correctly', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('lineage-node-dim_customer')).toBeInTheDocument();
  });

  it('renders node with dbt icon correctly', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps2} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('lineage-node-dim_customer')).toBeInTheDocument();
    expect(screen.getByTestId('dbt-icon')).toBeInTheDocument();
  });
});
