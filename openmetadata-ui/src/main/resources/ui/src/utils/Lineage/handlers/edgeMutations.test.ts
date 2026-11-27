/*
 *  Copyright 2025 Collate.
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
import { Edge, Node } from 'reactflow';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { SourceType } from '../../../interface/source.interface';
import { getLineageEdgeDetails } from '../../../rest/lineageAPI';
import { addLineage } from '../../../rest/miscAPI';
import { showErrorToast } from '../../ToastUtils';
import {
  onAddPipelineClick,
  onColumnEdgeRemove,
  onEdgeClick,
  saveLineageEdge,
} from './edgeMutations';

jest.mock('../../../rest/lineageAPI', () => ({
  getLineageEdgeDetails: jest.fn(),
}));
jest.mock('../../../rest/miscAPI', () => ({
  ...jest.requireActual('../../../rest/miscAPI'),
  addLineage: jest.fn(),
}));
jest.mock('../../ToastUtils', () => ({ showErrorToast: jest.fn() }));

describe('onEdgeClick', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('selects the edge, opens the drawer and clears node selection', () => {
    useLineageStore.setState({
      activeNode: { id: 'node1' } as unknown as Node,
      selectedNode: { id: 'node1' } as unknown as SourceType,
      tracedNodes: new Set(['node1']),
      isDrawerOpen: false,
    });

    const edge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
    } as unknown as Edge;

    onEdgeClick(edge);

    const state = useLineageStore.getState();

    expect(state.selectedEdge).toBe(edge);
    expect(state.isDrawerOpen).toBe(true);
    expect(state.activeNode).toBeUndefined();
    expect(state.selectedNode).toBeUndefined();
    expect(state.tracedNodes.size).toBe(0);
  });

  it('traces the source/target column handles for a column-level edge', () => {
    const edge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      sourceHandle: 'node1.col1',
      targetHandle: 'node2.col2',
    } as unknown as Edge;

    onEdgeClick(edge);

    const state = useLineageStore.getState();

    expect(state.tracedColumns).toEqual(new Set(['node1.col1', 'node2.col2']));
  });

  it('does not set traced columns when handles are absent', () => {
    useLineageStore.setState({ tracedColumns: new Set(['prior.col']) });

    const edge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
    } as unknown as Edge;

    onEdgeClick(edge);

    expect(useLineageStore.getState().tracedColumns).toEqual(
      new Set(['prior.col'])
    );
  });
});

describe('onAddPipelineClick', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('opens the add-edge modal', () => {
    expect(useLineageStore.getState().showAddEdgeModal).toBe(false);

    onAddPipelineClick();

    expect(useLineageStore.getState().showAddEdgeModal).toBe(true);
  });
});

describe('onColumnEdgeRemove', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('opens the delete-edge confirmation modal', () => {
    expect(useLineageStore.getState().showDeleteModal).toBe(false);

    onColumnEdgeRemove();

    expect(useLineageStore.getState().showDeleteModal).toBe(true);
  });
});

describe('saveLineageEdge', () => {
  const orders = { id: 'orders', type: 'table' };
  const customers = { id: 'customers', type: 'table' };
  const notFound = { response: { status: 404 } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the edge from the first entity to the second', async () => {
    (getLineageEdgeDetails as jest.Mock).mockRejectedValue(notFound);
    (addLineage as jest.Mock).mockResolvedValue({});

    await expect(saveLineageEdge(orders, customers)).resolves.toBe(true);

    expect(addLineage).toHaveBeenCalledWith(
      expect.objectContaining({
        edge: expect.objectContaining({
          fromEntity: expect.objectContaining({ id: 'orders' }),
          toEntity: expect.objectContaining({ id: 'customers' }),
        }),
      })
    );
  });

  it('resolves false with a single toast when the save fails', async () => {
    (getLineageEdgeDetails as jest.Mock).mockRejectedValue(notFound);
    (addLineage as jest.Mock).mockRejectedValue(new Error('forbidden'));

    await expect(saveLineageEdge(orders, customers)).resolves.toBe(false);

    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('rejects, without toasting, when the edge lookup fails', async () => {
    const serverError = { response: { status: 500 } };
    (getLineageEdgeDetails as jest.Mock).mockRejectedValue(serverError);

    await expect(saveLineageEdge(orders, customers)).rejects.toBe(serverError);

    expect(addLineage).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
