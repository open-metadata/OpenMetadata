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
import {
  act,
  fireEvent,
  queryByText,
  render,
  screen,
} from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLayer } from '../../../../generated/settings/settings';
import LineageLayers from './LineageLayers';

const onMockColumnClick = jest.fn();
const onMockUpdateLayerView = jest.fn();

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

jest.mock('../../../../context/LineageProvider/LineageProvider', () => ({
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
    activeLayer: [],
    fetchPipelineStatus: jest.fn(),
    onColumnClick: onMockColumnClick,
    onUpdateLayerView: onMockUpdateLayerView,
  })),
}));

describe('LineageLayers component', () => {
  it('renders LineageLayers component', () => {
    const { container } = render(
      <ReactFlowProvider>
        <LineageLayers entityType={EntityType.TABLE} />
      </ReactFlowProvider>
    );
    const layerBtn = screen.getByText('label.layer-plural');

    expect(layerBtn).toBeInTheDocument();

    const columnButton = queryByText(container, 'label.column');
    const pipelineButton = queryByText(container, 'label.pipeline');
    const dataQualityButton = queryByText(container, 'label.data-quality');

    expect(columnButton).not.toBeInTheDocument();
    expect(pipelineButton).not.toBeInTheDocument();
    expect(dataQualityButton).not.toBeInTheDocument();
  });

  it('calls onUpdateLayerView when a button is clicked', async () => {
    render(
      <ReactFlowProvider>
        <LineageLayers entityType={EntityType.TABLE} />
      </ReactFlowProvider>
    );

    const layerBtn = screen.getByTestId('lineage-layer-btn');

    await act(async () => {
      fireEvent.click(layerBtn);
    });

    const popover = screen.getByRole('tooltip');

    expect(popover).toBeInTheDocument();

    const columnButton = screen.getByText('label.column');
    const dataObservabilityBtn = screen.getByText('label.observability');

    expect(columnButton).toBeInTheDocument();
    expect(dataObservabilityBtn).toBeInTheDocument();

    fireEvent.click(columnButton as HTMLElement);

    expect(onMockUpdateLayerView).toHaveBeenCalledWith([
      LineageLayer.ColumnLevelLineage,
    ]);

    fireEvent.click(dataObservabilityBtn as HTMLElement);

    expect(onMockUpdateLayerView).toHaveBeenCalledWith([
      LineageLayer.DataObservability,
    ]);
  });
});
