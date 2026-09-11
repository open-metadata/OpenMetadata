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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../context/UntitledUIThemeProvider/theme-provider';
import { buildGraphPresentation } from '../../utils/knowledge-graph/knowledgeGraphPresentation.utils';
import {
  identifyGraphEdges,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';
import { GraphData } from './KnowledgeGraph.interface';
import KnowledgeGraphGroupInspector from './KnowledgeGraphGroupInspector';

beforeEach(() => jest.useRealTimers());

const members = Array.from({ length: 3 }, (_, index) => ({
  id: 'c' + index,
  label: 'column_' + index,
  type: 'column',
}));
const root = { id: 'root', label: 'Customers', type: 'table' };
const renderGroup = (edges: GraphData['edges']) => {
  const data = { nodes: [root, ...members], edges };
  const presented = buildGraphPresentation(
    data,
    data,
    root.id,
    'balanced',
    []
  ).data;
  const group = presented.nodes.find((node) => node.presentation?.members);
  if (!group) {
    throw new Error('Expected a relation group');
  }
  const onSelectRelationship = jest.fn();
  const onExpand = jest.fn();
  const onViewRelationships = jest.fn();
  render(
    <ThemeProvider>
      <KnowledgeGraphGroupInspector
        edges={transformToG6Format(presented).edges}
        node={group}
        nodes={new Map(data.nodes.map((node) => [node.id, node]))}
        onExpand={onExpand}
        onSelectRelationship={onSelectRelationship}
        onViewRelationships={onViewRelationships}
      />
    </ThemeProvider>
  );

  return { onSelectRelationship, onExpand, onViewRelationships };
};

it('shows the exact predicate and opens its original statement in one click despite identical labels', async () => {
  const edges = members.flatMap((member) => [
    {
      from: root.id,
      to: member.id,
      label: 'Has column',
      relationType: 'custom:legacyColumn',
    },
    {
      from: member.id,
      to: root.id,
      label: 'Has column',
      relationType: 'hasColumn',
    },
    {
      from: root.id,
      to: member.id,
      label: 'Has column',
      relationType: 'hasColumn',
    },
  ]);
  const { onSelectRelationship, onExpand, onViewRelationships } =
    renderGroup(edges);

  expect(screen.getByTestId('relationship-predicate')).toHaveTextContent(
    /^hasColumn$/
  );
  expect(screen.getByTestId('group-relationship-summary')).toHaveTextContent(
    'Customers → Has column → 3 label.column-plural'
  );

  await userEvent.click(
    screen.getByRole('button', { name: 'column_0 → Has column' })
  );
  const original = identifyGraphEdges(edges).find(
    (edge) =>
      edge.from === root.id &&
      edge.to === 'c0' &&
      edge.relationType === 'hasColumn'
  );

  expect(onSelectRelationship).toHaveBeenCalledWith(original?.id);

  await userEvent.click(
    screen.getByRole('button', { name: 'label.kg-expand-all-in-graph' })
  );

  expect(onExpand).toHaveBeenCalledTimes(1);

  await userEvent.click(
    screen.getByRole('button', { name: 'label.kg-view-in-list' })
  );

  expect(onViewRelationships).toHaveBeenCalledTimes(1);
});

it('preserves incoming direction in the summary and each member row', async () => {
  const edges = members.map((member) => ({
    from: member.id,
    to: root.id,
    label: 'Custom connection',
    relationType: 'https://example.com/connects',
  }));
  const { onSelectRelationship } = renderGroup(edges);

  expect(screen.getByTestId('group-relationship-summary')).toHaveTextContent(
    '3 label.column-plural → Custom connection → Customers'
  );
  expect(screen.getByTestId('relationship-predicate')).toHaveTextContent(
    'https://example.com/connects'
  );

  await userEvent.click(
    screen.getByRole('button', { name: 'column_0 ← Custom connection' })
  );

  expect(onSelectRelationship).toHaveBeenCalledWith(
    identifyGraphEdges(edges)[0].id
  );
});
