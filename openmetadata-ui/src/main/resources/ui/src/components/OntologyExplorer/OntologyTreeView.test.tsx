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
import { OntologyTreeGroup } from './OntologyStudio.utils';
import OntologyTreeView from './OntologyTreeView';

const ROOT: OntologyNode = {
  id: 'root',
  label: 'Customer',
  type: 'glossaryTerm',
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
        depth: 12,
        isIsolated: true,
        node: ORPHAN,
        parentCount: 0,
        relationCount: 0,
      },
    ],
  },
];

describe('OntologyTreeView', () => {
  it('shows an empty message when there are no groups', () => {
    render(<OntologyTreeView groups={[]} onSelect={jest.fn()} />);

    expect(screen.getByTestId('ontology-tree-view')).toBeInTheDocument();
    expect(screen.getByText('message.ontology-tree-description')).toBeVisible();
    expect(screen.getByText('message.no-glossary-terms-found')).toBeVisible();
    expect(screen.queryByTestId('ontology-tree-group')).not.toBeInTheDocument();
  });

  it('renders each glossary group with its terms, badges and counts', () => {
    render(<OntologyTreeView groups={GROUPS} onSelect={jest.fn()} />);

    const group = screen.getByTestId('ontology-tree-group');

    expect(within(group).getByText('Commerce')).toBeVisible();
    expect(within(group).getByText('label.x-terms')).toBeVisible();
    expect(screen.getAllByText('label.x-relations')).toHaveLength(2);
    expect(screen.getByText('label.polyhierarchy')).toBeVisible();

    const orphanButton = screen.getByTestId('ontology-tree-term-orphan');

    expect(within(orphanButton).getByText('label.isolated')).toBeVisible();
    expect(
      within(orphanButton).queryByText('label.x-relations')
    ).not.toBeInTheDocument();
  });

  it('caps the indentation depth at eight levels', () => {
    render(<OntologyTreeView groups={GROUPS} onSelect={jest.fn()} />);

    const orphanButton = screen.getByTestId('ontology-tree-term-orphan');
    const childButton = screen.getByTestId('ontology-tree-term-child');

    expect(orphanButton.querySelector('span.tw\\:shrink-0')).toHaveStyle({
      width: `${8 * 18}px`,
    });
    expect(childButton.querySelector('span.tw\\:shrink-0')).toHaveStyle({
      width: '18px',
    });
  });

  it('highlights the selected node and reports clicks', () => {
    const onSelect = jest.fn();
    render(
      <OntologyTreeView
        groups={GROUPS}
        selectedNodeId={CHILD.id}
        onSelect={onSelect}
      />
    );

    expect(screen.getByTestId('ontology-tree-term-child')).toHaveClass(
      'tw:border-brand'
    );
    expect(screen.getByTestId('ontology-tree-term-root')).toHaveClass(
      'tw:border-transparent'
    );

    fireEvent.click(screen.getByTestId('ontology-tree-term-root'));

    expect(onSelect).toHaveBeenCalledWith(ROOT);
  });
});
