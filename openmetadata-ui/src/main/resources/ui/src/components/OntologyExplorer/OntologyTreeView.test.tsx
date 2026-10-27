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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { OntologyNode } from './OntologyExplorer.interface';
import {
  buildNativeTreeIndex,
  nativeTreePlacementKey,
  OntologyTreeGroup,
  OntologyTreeMetric,
} from './OntologyStudio.utils';
import OntologyTreeView from './OntologyTreeView';

const ROOT: OntologyNode = {
  id: 'root',
  label: 'Customer',
  type: 'glossaryTerm',
  fullyQualifiedName: 'Commerce.Customer',
};
const CHILD: OntologyNode = {
  id: 'child',
  label: 'Order',
  type: 'glossaryTerm',
};
const ORPHAN: OntologyNode = {
  id: 'orphan',
  label: 'Lonely',
  type: 'glossaryTermIsolated',
};
const METRIC: OntologyNode = { id: 'metric', label: 'Revenue', type: 'metric' };

const GROUPS: OntologyTreeGroup[] = [
  {
    glossaryId: 'g-1',
    glossaryName: 'Commerce',
    rows: [
      {
        depth: 0,
        isIsolated: false,
        node: ROOT,
        parentCount: 0,
        relationCount: 3,
      },
      {
        depth: 1,
        isIsolated: false,
        node: CHILD,
        parentCount: 2,
        relationCount: 1,
      },
      {
        depth: 0,
        isIsolated: true,
        node: ORPHAN,
        parentCount: 0,
        relationCount: 0,
      },
    ],
  },
];
const METRICS: OntologyTreeMetric[] = [{ measures: [ROOT], node: METRIC }];

const renderTree = (
  props: Partial<Parameters<typeof OntologyTreeView>[0]> = {}
) => {
  const handlers = { onConnect: jest.fn(), onSelect: jest.fn() };
  render(
    <OntologyTreeView
      metrics={METRICS}
      source={{ kind: 'glossary', groups: GROUPS }}
      {...handlers}
      {...props}
    />
  );

  return handlers;
};

describe('OntologyTreeView', () => {
  it('shows an empty message when there is nothing to list', () => {
    renderTree({ source: { kind: 'glossary', groups: [] }, metrics: [] });

    expect(screen.getByText('message.no-glossary-terms-found')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-tree-concepts')
    ).not.toBeInTheDocument();
  });

  it('splits concepts, metrics and unconnected terms into their own sections', () => {
    renderTree();

    const concepts = screen.getByTestId('ontology-tree-concepts');
    const metrics = screen.getByTestId('ontology-tree-metrics');
    const unconnected = screen.getByTestId('ontology-tree-unconnected');

    expect(within(concepts).getByText('Customer')).toBeVisible();
    expect(screen.getByTestId('ontology-tree-term-child')).toBeInTheDocument();
    expect(within(concepts).getByText('Commerce.Customer')).toBeVisible();
    expect(within(concepts).getByText('Order')).toBeVisible();
    expect(within(concepts).getByText('label.polyhierarchy')).toBeVisible();
    expect(within(concepts).queryByText('Lonely')).not.toBeInTheDocument();
    expect(within(metrics).getByText('Revenue')).toBeVisible();
    expect(within(metrics).getByText('Customer')).toBeVisible();
    expect(within(unconnected).getByText('Lonely')).toBeVisible();
  });

  it('collapses and expands the concept hierarchy', () => {
    renderTree();

    fireEvent.click(screen.getByTestId('ontology-tree-collapse-all'));

    expect(screen.queryByText('Order')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-tree-expand-all'));

    expect(screen.getByText('Order')).toBeVisible();
  });

  it('opens a row and connects an unconnected term', () => {
    const { onConnect, onSelect } = renderTree();

    fireEvent.click(screen.getByText('Order'));
    fireEvent.click(screen.getByTestId('ontology-tree-connect-orphan'));

    expect(onSelect).toHaveBeenCalledWith(CHILD);
    expect(onConnect).toHaveBeenCalledWith(ORPHAN);
  });
});

describe('native OntologyTreeView', () => {
  const graph = {
    nodes: ['a', 'b', 'c', 'leaf'].map((id) => ({
      id,
      label: id,
      type: 'glossaryTerm',
      glossaryId: 'owner',
    })),
    edges: [
      ['a', 'c'],
      ['b', 'c'],
      ['c', 'leaf'],
    ].map(([from, to]) => ({
      from,
      to,
      label: 'Parent',
      relationType: 'parentOf',
    })),
  };
  const filters = {
    glossaryIds: [],
    relationTypes: [],
    searchQuery: '',
    showCrossGlossaryOnly: false,
    showIsolatedNodes: true,
    viewMode: 'overview' as const,
  };

  it('shows every placement and independently collapses one branch', () => {
    const index = buildNativeTreeIndex(graph, filters, []);
    renderTree({ source: { kind: 'native', index }, metrics: [] });

    expect(screen.getAllByTestId('ontology-tree-term-c')).toHaveLength(2);
    expect(screen.getAllByTestId('ontology-tree-term-leaf')).toHaveLength(2);
    expect(screen.getAllByText('label.ontology-also-under')).toHaveLength(2);

    const firstChild = screen
      .getAllByTestId('ontology-tree-term-c')
      .find(
        (row) =>
          row.getAttribute('data-key') ===
          nativeTreePlacementKey(index, ['a', 'c'])
      );

    expect(firstChild).toBeDefined();

    if (!firstChild) {
      throw new Error('Expected placement under a');
    }
    fireEvent.click(within(firstChild).getByTestId('tree-expand-btn'));

    expect(screen.getAllByTestId('ontology-tree-term-c')).toHaveLength(2);
    expect(screen.getAllByTestId('ontology-tree-term-leaf')).toHaveLength(1);
  });

  it('reveals an external concept selection after collapse and selects only one placement', async () => {
    const index = buildNativeTreeIndex(graph, filters, []);
    const { rerender } = render(
      <OntologyTreeView
        source={{ kind: 'native', index }}
        onSelect={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('ontology-tree-collapse-all'));

    expect(
      screen.queryByTestId('ontology-tree-term-c')
    ).not.toBeInTheDocument();

    rerender(
      <OntologyTreeView
        selectedNodeId="c"
        source={{ kind: 'native', index }}
        onSelect={jest.fn()}
      />
    );

    expect(
      screen
        .getAllByTestId('ontology-tree-term-c')
        .filter((row) => row.getAttribute('aria-selected') === 'true')
    ).toHaveLength(1);

    await waitFor(() =>
      expect(
        screen.getByRole('row', { name: 'c', selected: true })
      ).toHaveFocus()
    );
    fireEvent.click(screen.getByTestId('ontology-tree-expand-all'));

    expect(screen.getAllByTestId('ontology-tree-term-leaf')).toHaveLength(2);
  });

  it('keeps the clicked placement while the selected prop lags behind a router transition', () => {
    const index = buildNativeTreeIndex(graph, filters, []);
    const onSelect = jest.fn();
    const { rerender } = render(
      <OntologyTreeView
        source={{ kind: 'native', index }}
        onSelect={onSelect}
      />
    );
    const underB = screen
      .getAllByTestId('ontology-tree-term-c')
      .find(
        (row) =>
          row.getAttribute('data-key') ===
          nativeTreePlacementKey(index, ['b', 'c'])
      );
    if (!underB) {
      throw new Error('Expected placement under b');
    }
    fireEvent.click(underB);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
    expect(
      screen
        .getAllByTestId('ontology-tree-term-c')
        .filter((row) => row.getAttribute('aria-selected') === 'true')
        .map((row) => row.getAttribute('data-key'))
    ).toEqual([nativeTreePlacementKey(index, ['b', 'c'])]);

    rerender(
      <OntologyTreeView
        selectedNodeId="c"
        source={{ kind: 'native', index }}
        onSelect={onSelect}
      />
    );

    expect(
      screen
        .getAllByTestId('ontology-tree-term-c')
        .filter((row) => row.getAttribute('aria-selected') === 'true')
        .map((row) => row.getAttribute('data-key'))
    ).toEqual([nativeTreePlacementKey(index, ['b', 'c'])]);
  });

  it('replaces bounded windows and retains focus on explicit navigation controls', async () => {
    const index = buildNativeTreeIndex(
      {
        nodes: Array.from({ length: 2050 }, (_, n) => ({
          id: String(n),
          label: String(n).padStart(4, '0'),
          type: 'glossaryTerm',
          glossaryId: 'owner',
        })),
        edges: [],
      },
      filters,
      []
    );
    renderTree({ source: { kind: 'native', index } });

    expect(screen.getByTestId('ontology-tree-term-0')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-tree-term-2048')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-tree-next'));

    expect(screen.getByTestId('ontology-tree-term-2049')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-tree-term-0')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-tree-next')).toHaveFocus();
    expect(screen.getByTestId('ontology-tree-next')).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    fireEvent.click(screen.getByTestId('ontology-tree-next'));

    expect(screen.getByTestId('ontology-tree-term-2049')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-tree-previous'));

    expect(screen.getByTestId('ontology-tree-term-0')).toBeVisible();
    expect(screen.getByTestId('ontology-tree-previous')).toHaveFocus();

    fireEvent.click(screen.getByTestId('ontology-tree-previous'));

    expect(screen.getByTestId('ontology-tree-term-0')).toBeVisible();
  });

  it('connects an isolated native concept and resets disclosure for a replaced model', () => {
    const onConnect = jest.fn();
    const index = buildNativeTreeIndex(
      { nodes: [ORPHAN], edges: [] },
      filters,
      []
    );
    const { rerender } = render(
      <OntologyTreeView
        source={{ kind: 'native', index }}
        onConnect={onConnect}
        onSelect={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.connect' }));

    expect(onConnect).toHaveBeenCalledWith(ORPHAN);

    fireEvent.click(screen.getByTestId('ontology-tree-collapse-all'));
    rerender(
      <OntologyTreeView
        source={{
          kind: 'native',
          index: buildNativeTreeIndex(graph, filters, []),
        }}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getAllByTestId('ontology-tree-term-leaf')).toHaveLength(2);
  });
});
