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
import { act } from 'react-test-renderer';
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
      testSuite: {
        deleted: false,
        description: 'This is an executable test suite linked to an entity',
        displayName: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.testSuite',
        id: 'fafada0f-a2e7-4dbe-a65c-8de057a63a7c',
        name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
        type: 'testSuite',
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
let isColumnLayerActive = false;
let isDataObservabilityLayerActive = false;

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
    activeLayer: [
      ...(isColumnLayerActive ? [LineageLayer.ColumnLevelLineage] : []),
      ...(isDataObservabilityLayerActive
        ? [LineageLayer.DataObservability]
        : []),
    ],
    expandAllColumns: true,
    fetchPipelineStatus: jest.fn(),
    onColumnClick: onMockColumnClick,
    loadChildNodesHandler: loadChildNodesHandlerMock,
  })),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn().mockImplementation(() =>
    Promise.resolve({
      testPassed: 5,
      testFailed: 2,
      testAborted: 1,
    })
  ),
}));

describe('CustomNodeV1', () => {
  beforeEach(() => {
    isColumnLayerActive = false;
    isDataObservabilityLayerActive = false;
  });

  it('renders node correctly', () => {
    isColumnLayerActive = true;
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

  it('should render children dropdown button', () => {
    isColumnLayerActive = true;
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    screen.debug(undefined, Infinity);
    screen.logTestingPlaygroundURL();

    expect(
      screen.getByTestId('children-info-dropdown-btn')
    ).toBeInTheDocument();
  });

  it('should toggle columns list when children dropdown button is clicked', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const button = screen.getByTestId('children-info-dropdown-btn');

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
    isColumnLayerActive = true;
    isDataObservabilityLayerActive = true;

    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const expandBtn = screen.getByTestId('plus-icon');

    expect(expandBtn).toBeInTheDocument();

    fireEvent.mouseOver(expandBtn);

    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
  });

  it('should expand all when expand all button is clicked', () => {
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    const expandBtn = screen.getByTestId('plus-icon');

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

  it('should have Test summary widget when observability layer is applied', async () => {
    isDataObservabilityLayerActive = true;
    render(
      <ReactFlowProvider>
        <CustomNodeV1Component {...mockNodeDataProps} />
      </ReactFlowProvider>
    );

    await act(async () => {
      jest.runAllTimers(); // or jest.advanceTimersByTime(1000);
    });

    screen.debug(undefined, Infinity);

    expect(screen.getByTestId('test-passed')).toBeInTheDocument();
    expect(screen.getByTestId('test-aborted')).toBeInTheDocument();
    expect(screen.getByTestId('test-failed')).toBeInTheDocument();
  });
});
