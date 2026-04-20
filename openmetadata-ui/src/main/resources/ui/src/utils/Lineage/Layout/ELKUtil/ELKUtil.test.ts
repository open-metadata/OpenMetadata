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
import { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import ELKLayout from './ELKUtil';

const mockElkLayout = jest.fn();

jest.mock('elkjs/lib/elk.bundled.js', () => {
  return jest.fn().mockImplementation(() => ({
    layout: mockElkLayout,
  }));
});

describe('ELKLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct default layout options', () => {
    expect(ELKLayout.layoutOptions).toEqual({
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '200',
      'elk.layered.nodePlacement.strategy': 'SIMPLE',
      'elk.partitioning.activate': 'true',
    });
  });

  it('creates ELK instance on first call to getElk', () => {
    const elk = ELKLayout.getElk();

    expect(elk).toBeDefined();
  });

  it('returns same ELK instance on subsequent calls', () => {
    const elk1 = ELKLayout.getElk();
    const elk2 = ELKLayout.getElk();

    expect(elk1).toBe(elk2);
  });

  it('calls elk.layout with correct parameters', async () => {
    const nodes: ElkNode[] = [
      { id: 'node1', width: 100, height: 50 },
      { id: 'node2', width: 100, height: 50 },
    ];

    const edges: ElkExtendedEdge[] = [
      { id: 'edge1', sources: ['node1'], targets: ['node2'] },
    ];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: nodes,
      edges: edges,
    });

    await ELKLayout.layoutGraph(nodes, edges);

    expect(mockElkLayout).toHaveBeenCalledWith({
      id: 'root',
      layoutOptions: ELKLayout.layoutOptions,
      children: nodes,
      edges: edges,
    });
  });

  it('returns layout result from elk.layout', async () => {
    const nodes: ElkNode[] = [
      { id: 'node1', width: 100, height: 50 },
      { id: 'node2', width: 100, height: 50 },
    ];

    const edges: ElkExtendedEdge[] = [
      { id: 'edge1', sources: ['node1'], targets: ['node2'] },
    ];

    const expectedResult = {
      id: 'root',
      children: [
        { id: 'node1', x: 0, y: 0, width: 100, height: 50 },
        { id: 'node2', x: 250, y: 0, width: 100, height: 50 },
      ],
      edges: edges,
    };

    mockElkLayout.mockResolvedValue(expectedResult);

    const result = await ELKLayout.layoutGraph(nodes, edges);

    expect(result).toEqual(expectedResult);
  });

  it('handles empty nodes array', async () => {
    const nodes: ElkNode[] = [];
    const edges: ElkExtendedEdge[] = [];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: [],
      edges: [],
    });

    const result = await ELKLayout.layoutGraph(nodes, edges);

    expect(result).toEqual({
      id: 'root',
      children: [],
      edges: [],
    });
  });

  it('handles nodes without edges', async () => {
    const nodes: ElkNode[] = [
      { id: 'node1', width: 100, height: 50 },
      { id: 'node2', width: 100, height: 50 },
    ];

    const edges: ElkExtendedEdge[] = [];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: nodes,
      edges: [],
    });

    await ELKLayout.layoutGraph(nodes, edges);

    expect(mockElkLayout).toHaveBeenCalledWith({
      id: 'root',
      layoutOptions: ELKLayout.layoutOptions,
      children: nodes,
      edges: [],
    });
  });

  it('handles multiple edges', async () => {
    const nodes: ElkNode[] = [
      { id: 'node1', width: 100, height: 50 },
      { id: 'node2', width: 100, height: 50 },
      { id: 'node3', width: 100, height: 50 },
    ];

    const edges: ElkExtendedEdge[] = [
      { id: 'edge1', sources: ['node1'], targets: ['node2'] },
      { id: 'edge2', sources: ['node2'], targets: ['node3'] },
      { id: 'edge3', sources: ['node1'], targets: ['node3'] },
    ];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: nodes,
      edges: edges,
    });

    await ELKLayout.layoutGraph(nodes, edges);

    expect(mockElkLayout).toHaveBeenCalledWith({
      id: 'root',
      layoutOptions: ELKLayout.layoutOptions,
      children: nodes,
      edges: edges,
    });
  });

  it('handles nodes with different sizes', async () => {
    const nodes: ElkNode[] = [
      { id: 'node1', width: 150, height: 75 },
      { id: 'node2', width: 200, height: 100 },
      { id: 'node3', width: 100, height: 50 },
    ];

    const edges: ElkExtendedEdge[] = [
      { id: 'edge1', sources: ['node1'], targets: ['node2'] },
    ];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: nodes,
      edges: edges,
    });

    const result = await ELKLayout.layoutGraph(nodes, edges);

    expect(result).toBeDefined();
    expect(mockElkLayout).toHaveBeenCalled();
  });

  it('handles layout errors', async () => {
    const nodes: ElkNode[] = [{ id: 'node1', width: 100, height: 50 }];
    const edges: ElkExtendedEdge[] = [];

    const error = new Error('Layout failed');
    mockElkLayout.mockRejectedValue(error);

    await expect(ELKLayout.layoutGraph(nodes, edges)).rejects.toThrow(
      'Layout failed'
    );
  });

  it('handles nodes with labels', async () => {
    const nodes: ElkNode[] = [
      {
        id: 'node1',
        width: 100,
        height: 50,
        labels: [{ text: 'Node 1' }],
      },
      {
        id: 'node2',
        width: 100,
        height: 50,
        labels: [{ text: 'Node 2' }],
      },
    ];

    const edges: ElkExtendedEdge[] = [
      { id: 'edge1', sources: ['node1'], targets: ['node2'] },
    ];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: nodes,
      edges: edges,
    });

    await ELKLayout.layoutGraph(nodes, edges);

    expect(mockElkLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({ labels: expect.any(Array) }),
        ]),
      })
    );
  });

  it('handles nodes with ports', async () => {
    const nodes: ElkNode[] = [
      {
        id: 'node1',
        width: 100,
        height: 50,
        ports: [{ id: 'port1' }],
      },
      {
        id: 'node2',
        width: 100,
        height: 50,
        ports: [{ id: 'port2' }],
      },
    ];

    const edges: ElkExtendedEdge[] = [
      {
        id: 'edge1',
        sources: ['port1'],
        targets: ['port2'],
      },
    ];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: nodes,
      edges: edges,
    });

    await ELKLayout.layoutGraph(nodes, edges);

    expect(mockElkLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({ ports: expect.any(Array) }),
        ]),
      })
    );
  });

  it('handles hierarchical nodes', async () => {
    const nodes: ElkNode[] = [
      {
        id: 'parent',
        width: 300,
        height: 200,
        children: [
          { id: 'child1', width: 100, height: 50 },
          { id: 'child2', width: 100, height: 50 },
        ],
      },
      {
        id: 'node2',
        width: 100,
        height: 50,
      },
    ];

    const edges: ElkExtendedEdge[] = [
      { id: 'edge1', sources: ['child1'], targets: ['node2'] },
    ];

    mockElkLayout.mockResolvedValue({
      id: 'root',
      children: nodes,
      edges: edges,
    });

    await ELKLayout.layoutGraph(nodes, edges);

    expect(mockElkLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({ children: expect.any(Array) }),
        ]),
      })
    );
  });

  it('uses layered algorithm', () => {
    expect(ELKLayout.layoutOptions['elk.algorithm']).toBe('layered');
  });

  it('uses right direction for layout', () => {
    expect(ELKLayout.layoutOptions['elk.direction']).toBe('RIGHT');
  });

  it('has correct node spacing', () => {
    expect(ELKLayout.layoutOptions['elk.spacing.nodeNode']).toBe('80');
  });

  it('has correct layer spacing', () => {
    expect(
      ELKLayout.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers']
    ).toBe('200');
  });

  it('uses simple node placement strategy', () => {
    expect(ELKLayout.layoutOptions['elk.layered.nodePlacement.strategy']).toBe(
      'SIMPLE'
    );
  });

  it('activates partitioning', () => {
    expect(ELKLayout.layoutOptions['elk.partitioning.activate']).toBe('true');
  });
});
