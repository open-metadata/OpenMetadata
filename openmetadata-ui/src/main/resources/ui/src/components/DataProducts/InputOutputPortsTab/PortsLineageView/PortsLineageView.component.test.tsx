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

import { render, waitFor } from '@testing-library/react';
import { Edge, Node, ReactFlowProvider } from 'reactflow';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import DataProductNode from './DataProductNode.component';
import PortNode from './PortNode.component';
import PortsLineageView from './PortsLineageView.component';
import { DataProductNodeProps, PortNodeProps } from './PortsLineageView.types';

// React Flow's real <ReactFlow> canvas can't measure itself in jsdom (zero
// size), which would mask edge/handle wiring bugs. So we keep the real hooks
// (useNodesState/useEdgesState are pure useState, no provider needed) and the
// real <Handle>/<ReactFlowProvider>, but swap the default <ReactFlow> export
// for a recorder that captures the `nodes`/`edges` props the component builds.
// `useReactFlow` is stubbed so PortsLineageView can render with no provider,
// and to keep the post-fit setTimeout effects inert under fake timers.
let mockCapturedNodes: Node[] = [];
let mockCapturedEdges: Edge[] = [];

jest.mock('reactflow', () => {
  const actual = jest.requireActual('reactflow');

  return {
    ...actual,
    // Without `__esModule: true`, the `import ReactFlow from 'reactflow'`
    // default import in PortsLineageView resolves to the whole module object
    // (an object, not a component) and React fails with "Element type is
    // invalid".
    __esModule: true,
    useReactFlow: () => ({ fitView: jest.fn(), zoomTo: jest.fn() }),
    default: ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      mockCapturedNodes = nodes;
      mockCapturedEdges = edges;

      return null;
    },
  };
});

const dataProduct = {
  id: 'dp-uuid-1',
  name: 'myDataProduct',
  fullyQualifiedName: 'domain.myDataProduct',
} as DataProduct;

const inputPort = {
  id: 'uuid-input-1',
  name: 'consumerTable',
  fullyQualifiedName: 'domain.myDataProduct.consumerTable',
  entityType: 'table',
};

const outputPort = {
  id: 'uuid-output-1',
  name: 'supplierTable',
  fullyQualifiedName: 'domain.myDataProduct.supplierTable',
  entityType: 'table',
};

const inputPortsData = [
  {
    _id: 'uuid-input-1',
    _index: 'dataAsset',
    _source: inputPort,
  },
] as unknown as SearchedDataProps['data'];

const outputPortsData = [
  {
    _id: 'uuid-output-1',
    _index: 'dataAsset',
    _source: outputPort,
  },
] as unknown as SearchedDataProps['data'];

// For every captured node, render its real component (inside a real
// ReactFlowProvider so the real <Handle>'s store context exists) and read the
// handle ids it actually registers, split by handle type. The real <Handle>
// emits `data-handleid` and a `source`/`target` class, so we can read back
// exactly what React Flow's `getHandle` will match against.
const collectHandleIds = (
  node: Node
): { sources: string[]; targets: string[] } => {
  const utils = render(
    <ReactFlowProvider>
      {node.type === 'dataProductNode' ? (
        <DataProductNode {...({ data: node.data } as DataProductNodeProps)} />
      ) : (
        <PortNode {...({ data: node.data } as PortNodeProps)} />
      )}
    </ReactFlowProvider>
  );

  const sources = Array.from(
    utils.container.querySelectorAll<HTMLElement>('.react-flow__handle.source')
  ).map((h) => h.getAttribute('data-handleid') ?? '');
  const targets = Array.from(
    utils.container.querySelectorAll<HTMLElement>('.react-flow__handle.target')
  ).map((h) => h.getAttribute('data-handleid') ?? '');
  utils.unmount();

  return { sources, targets };
};

const waitForCapturedGraph = () =>
  waitFor(() => {
    expect(mockCapturedNodes.length).toBeGreaterThan(0);
    expect(mockCapturedEdges.length).toBeGreaterThan(0);
  });

describe('PortsLineageView handle-id wiring', () => {
  beforeEach(() => {
    mockCapturedNodes = [];
    mockCapturedEdges = [];
    render(
      <PortsLineageView
        assetCount={2}
        dataProduct={dataProduct}
        inputPortsData={inputPortsData}
        outputPortsData={outputPortsData}
      />
    );
  });

  it('builds one center node plus one node per input/output port', async () => {
    await waitForCapturedGraph();

    expect(mockCapturedNodes).toHaveLength(3);
    expect(
      mockCapturedNodes.find((n) => n.id === 'data-product-center')
    ).toBeDefined();
    expect(
      mockCapturedNodes.find((n) =>
        n.id.startsWith('input-domain.myDataProduct.consumerTable')
      )
    ).toBeDefined();
    expect(
      mockCapturedNodes.find((n) =>
        n.id.startsWith('output-domain.myDataProduct.supplierTable')
      )
    ).toBeDefined();
  });

  it('builds one edge per port', async () => {
    await waitForCapturedGraph();

    expect(mockCapturedEdges).toHaveLength(2);
    expect(
      mockCapturedEdges.find((e) => e.source.startsWith('input-'))
    ).toBeDefined();
    expect(
      mockCapturedEdges.find((e) => e.target.startsWith('output-'))
    ).toBeDefined();
  });

  it('threads the port FQN (not the UUID) as data.handleId on the port nodes', async () => {
    await waitForCapturedGraph();

    const inputNode = mockCapturedNodes.find((n) =>
      n.id.startsWith('input-')
    ) as Node<{ handleId: string }>;
    const outputNode = mockCapturedNodes.find((n) =>
      n.id.startsWith('output-')
    ) as Node<{ handleId: string }>;

    expect(inputNode.data.handleId).toBe(inputPort.fullyQualifiedName);
    expect(outputNode.data.handleId).toBe(outputPort.fullyQualifiedName);
    expect(inputNode.data.handleId).not.toBe(inputPort.id);
    expect(outputNode.data.handleId).not.toBe(outputPort.id);
  });

  it('input edge sourceHandle matches the Handle id PortNode offers', async () => {
    await waitForCapturedGraph();

    const inputEdge = mockCapturedEdges.find((e) =>
      e.id.startsWith('edge-input-')
    ) as Edge;
    const inputNode = mockCapturedNodes.find((n) =>
      n.id.startsWith('input-')
    ) as Node;

    // Render the PortNode the edge points from and read the handle id React
    // Flow will actually see. Before the fix, PortNode registered `port.id`
    // (UUID) while the edge referenced the FQN -> React Flow error 008 -> the
    // edge rendered null.
    const { sources } = collectHandleIds(inputNode);

    expect(inputEdge.sourceHandle).toBeDefined();
    expect(sources).toContain(inputEdge.sourceHandle);
    expect(inputEdge.sourceHandle).toBe(inputPort.fullyQualifiedName);
    expect(inputEdge.sourceHandle).not.toBe(inputPort.id);
  });

  it('output edge targetHandle matches the Handle id PortNode offers', async () => {
    await waitForCapturedGraph();

    const outputEdge = mockCapturedEdges.find((e) =>
      e.id.startsWith('edge-center-to-output-')
    ) as Edge;
    const outputNode = mockCapturedNodes.find((n) =>
      n.id.startsWith('output-')
    ) as Node;

    const { targets } = collectHandleIds(outputNode);

    expect(outputEdge.targetHandle).toBeDefined();
    expect(targets).toContain(outputEdge.targetHandle);
    expect(outputEdge.targetHandle).toBe(outputPort.fullyQualifiedName);
    expect(outputEdge.targetHandle).not.toBe(outputPort.id);
  });

  it('input edge targetHandle matches the left Handle DataProductNode offers', async () => {
    await waitForCapturedGraph();

    const inputEdge = mockCapturedEdges.find((e) =>
      e.id.startsWith('edge-input-')
    ) as Edge;
    const centerNode = mockCapturedNodes.find(
      (n) => n.id === 'data-product-center'
    ) as Node;

    const { targets } = collectHandleIds(centerNode);

    expect(targets).toContain(inputEdge.targetHandle);
    expect(inputEdge.targetHandle).toBe(`${dataProduct.id}-left`);
  });

  it('output edge sourceHandle matches the right Handle DataProductNode offers', async () => {
    await waitForCapturedGraph();

    const outputEdge = mockCapturedEdges.find((e) =>
      e.id.startsWith('edge-center-to-output-')
    ) as Edge;
    const centerNode = mockCapturedNodes.find(
      (n) => n.id === 'data-product-center'
    ) as Node;

    const { sources } = collectHandleIds(centerNode);

    expect(sources).toContain(outputEdge.sourceHandle);
    expect(outputEdge.sourceHandle).toBe(`${dataProduct.id}-right`);
  });

  // The master guard: React Flow's v11 EdgeRenderer returns null (error 008)
  // for ANY edge whose source/target handle id can't be resolved on its node.
  // Asserting every edge resolves on both ends means the lineage view will
  // actually draw edges — i.e. the bug this fix addresses cannot recur without
  // breaking one of these assertions.
  it('every edge resolves on both ends (no React Flow error 008)', async () => {
    await waitForCapturedGraph();

    const handlesByNode = new Map<
      string,
      { sources: string[]; targets: string[] }
    >();
    mockCapturedNodes.forEach((n) => {
      handlesByNode.set(n.id, collectHandleIds(n));
    });

    mockCapturedEdges.forEach((edge) => {
      const sourceHandles = handlesByNode.get(edge.source)?.sources ?? [];
      const targetHandles = handlesByNode.get(edge.target)?.targets ?? [];

      expect(sourceHandles).toContain(edge.sourceHandle);
      expect(targetHandles).toContain(edge.targetHandle);
    });
  });

  it('uses only FQN-based handle ids (every port Handle id is a FQN, never a UUID)', async () => {
    await waitForCapturedGraph();

    mockCapturedNodes
      .filter((n) => n.type === 'portNode')
      .forEach((n) => {
        const { sources, targets } = collectHandleIds(n);
        const portId = (n.data as { port?: { id?: string } }).port?.id;
        [...sources, ...targets].forEach((handleId) => {
          expect(handleId).not.toBe(portId);
        });
      });
  });
});
