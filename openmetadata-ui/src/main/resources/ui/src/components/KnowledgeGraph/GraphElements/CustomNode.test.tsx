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

import { NodeData } from '@antv/g6';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getNodeRenderKey } from '../../../utils/KnowledgeGraph.utils';
import CustomNode from './CustomNode';

beforeEach(() => jest.useRealTimers());

const node: NodeData = {
  id: 'customers',
  data: { label: 'Customers', type: 'table', level: 1 },
};
const renderNode = (data = node, onSelect = jest.fn(), onExpand = jest.fn()) =>
  render(
    <CustomNode
      nodeData={data}
      nodeRenderKey={getNodeRenderKey(data)}
      onExpand={onExpand}
      onSelect={onSelect}
    />
  );

it('exposes the entity name, type and level and supports keyboard selection', async () => {
  const onSelect = jest.fn();
  renderNode(node, onSelect);
  const button = screen.getByRole('button');

  expect(button).toHaveAttribute('data-node-id', 'customers');
  expect(screen.getByTestId('label')).toHaveTextContent('Customers');
  expect(screen.getByTestId('type-tag')).toHaveTextContent('label.table');

  button.focus();
  await userEvent.keyboard('{Enter}');

  expect(onSelect).toHaveBeenCalledWith(true);
});

it('shows member previews and expands a group directly without opening a second dialog', async () => {
  const onExpand = jest.fn();
  renderNode(
    {
      ...node,
      data: {
        ...node.data,
        presentation: {
          level: 2,
          position: { x: 0, y: 0 },
          size: [222, 152],
          members: Array.from({ length: 300 }, (_, index) => ({
            id: String(index),
            label: 'column_' + index,
            type: 'column',
          })),
        },
      },
    },
    jest.fn(),
    onExpand
  );

  expect(screen.getByText('column_0')).toBeVisible();
  expect(screen.getByText('column_2')).toBeVisible();
  expect(screen.queryByText('column_3')).not.toBeInTheDocument();
  expect(screen.getByText('300')).toBeVisible();

  await userEvent.click(
    screen.getByRole('button', { name: /label.kg-expand-group/ })
  );

  expect(onExpand).toHaveBeenCalledTimes(1);
});

it('updates an existing node when its label or group members change', () => {
  const mutable = { ...node, data: { ...node.data } };
  const { rerender } = renderNode(mutable);
  mutable.data.label = 'Updated customers';
  rerender(
    <CustomNode nodeData={mutable} nodeRenderKey={getNodeRenderKey(mutable)} />
  );

  expect(screen.getByTestId('label')).toHaveTextContent('Updated customers');
});

it('marks a root as mapped only when mapping evidence is present', () => {
  const root = {
    ...node,
    data: {
      ...node.data,
      presentation: {
        root: true,
        level: 1,
        position: { x: 0, y: 0 },
        size: [252, 80],
        coverage: 'mapped',
      },
    },
  };
  const { rerender } = renderNode(root);

  expect(screen.getByText('label.kg-mapped-to-ontology')).toBeVisible();

  root.data.presentation.coverage = 'unknown';
  rerender(
    <CustomNode nodeData={root} nodeRenderKey={getNodeRenderKey(root)} />
  );

  expect(
    screen.queryByText('label.kg-mapped-to-ontology')
  ).not.toBeInTheDocument();
});

it('reads glossary terms as business concepts', () => {
  renderNode({ ...node, data: { ...node.data, type: 'glossaryTerm' } });

  expect(screen.getByTestId('type-tag')).toHaveTextContent('label.concept');
});
