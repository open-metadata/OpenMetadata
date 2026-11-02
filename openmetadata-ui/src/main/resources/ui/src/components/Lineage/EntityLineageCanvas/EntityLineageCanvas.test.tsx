/*
 *  Copyright 2026 Collate.
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
import { act, render } from '@testing-library/react';
import { ReactNode } from 'react';
import { Node } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import { useLineageStore } from '../../../hooks/useLineageStore';
import EntityLineageCanvas from './EntityLineageCanvas';

const mockRenderedNodes: Node[][] = [];

jest.mock('reactflow', () => ({
  __esModule: true,
  default: ({ nodes }: { nodes: Node[] }) => {
    mockRenderedNodes.push(nodes);

    return null;
  },
  Background: () => null,
  MiniMap: () => null,
  Panel: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../../../utils/EntityLineageUtils', () => ({ nodeTypes: {} }));
jest.mock(
  '../../Entity/EntityLineage/LineageControlButtons/LineageControlButtons',
  () => () => null
);
jest.mock(
  '../../Entity/EntityLineage/LineageLayers/LineageLayers',
  () => () => null
);
jest.mock('../AddLineagePopover/AddLineagePopover', () => () => null);
jest.mock('../Edges/CanvasLayerWrapper/CanvasLayerWrapper', () => ({
  CanvasLayerWrapper: () => null,
}));
jest.mock('../LineageNodeDeleteModal/LineageNodeDeleteModal', () => () => null);
jest.mock('../LineageSkeleton.component', () => () => null);

const sourceNode = (x: number, data: Node['data']): Node => ({
  id: 'table1',
  type: 'default',
  position: { x, y: 0 },
  data,
});

describe('EntityLineageCanvas', () => {
  beforeEach(() => {
    mockRenderedNodes.length = 0;
    useLineageStore.getState().reset();
  });

  it('keeps each editable node data object while only positions change', () => {
    const data = {
      node: { id: 'table1', fullyQualifiedName: 'table1' },
    };
    act(() => {
      useLineageStore.setState({ init: true });
      useLineageStore.getState().setNodes([sourceNode(0, data)]);
    });
    render(
      <EntityLineageCanvas
        hasEditAccess
        deleted={false}
        entityType={EntityType.TABLE}
      />
    );
    const before = mockRenderedNodes[mockRenderedNodes.length - 1][0];

    // A drag frame: a new node object at a new position, same source data.
    act(() => {
      useLineageStore.getState().setNodes([sourceNode(40, data)]);
    });
    const after = mockRenderedNodes[mockRenderedNodes.length - 1][0];

    expect(before.data.isNodeEditable).toBe(true);
    expect(after.position).toEqual({ x: 40, y: 0 });
    expect(after.data).toBe(before.data);
  });
});
