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
import { fireEvent, render, screen } from '@testing-library/react';
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
const loadChildNodesHandlerMock = jest.fn();

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
    loadChildNodesHandler: loadChildNodesHandlerMock,
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: () => 'Columns',
  }),
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

  it('should render columns dropdown button', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    screen.debug(undefined, Infinity);
    screen.logTestingPlaygroundURL();

    expect(
      screen.getByRole('button', { name: /\d+\s*columns/i })
    ).toBeInTheDocument();
  });

  it('should toggle columns list when columns dropdown button is clicked', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const button = screen.getByRole('button', { name: /\d+\s*columns/i });

    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByText('col1')).toBeInTheDocument();
    expect(screen.getByText('col2')).toBeInTheDocument();
    expect(screen.getByText('col3')).toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.queryByText('col1')).not.toBeInTheDocument();
    expect(screen.queryByText('col2')).not.toBeInTheDocument();
    expect(screen.queryByText('col3')).not.toBeInTheDocument();
  });

  it('should have expand and expand all buttons', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const expandBtn = screen.getByTestId('lineage-expand-btn');

    expect(expandBtn).toBeInTheDocument();

    fireEvent.mouseOver(expandBtn);

    expect(screen.getByTestId('lineage-expand-btn')).toBeInTheDocument();
  });

  it('should expand all when expand all button is clicked', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const expandBtn = screen.getByTestId('lineage-expand-btn');

    fireEvent.click(expandBtn);

    expect(loadChildNodesHandlerMock).toHaveBeenCalledWith(
      expect.any(Object),
      'Downstream',
      1
    );

    fireEvent.mouseOver(expandBtn);

    const expandAllBtn = screen.getByTestId('lineage-expand-all-btn');

    fireEvent.click(expandAllBtn);

    expect(loadChildNodesHandlerMock).toHaveBeenCalledWith(
      expect.any(Object),
      'Downstream',
      50
    );
  });
});
