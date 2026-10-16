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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { OntologyNode } from './OntologyExplorer.interface';
import { OntologyTreeGroup, OntologyTreeMetric } from './OntologyStudio.utils';
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
      groups={GROUPS}
      metrics={METRICS}
      {...handlers}
      {...props}
    />
  );

  return handlers;
};

describe('OntologyTreeView', () => {
  it('shows an empty message when there is nothing to list', () => {
    renderTree({ groups: [], metrics: [] });

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
