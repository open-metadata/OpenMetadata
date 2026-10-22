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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { useOverlay } from 'react-aria';
import { ThemeProvider } from '../../../context/UntitledUIThemeProvider/theme-provider';
import { GraphSelection } from '../../../hooks/discovery/knowledge-graph/useKnowledgeGraphCanvas';
import { transformToG6Format } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import { buildGraphPresentation } from '../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';
import KnowledgeGraphOverlays from './KnowledgeGraphOverlays';

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn().mockReturnValue(null)
);

beforeEach(() => jest.useRealTimers());

const root = { id: 'root', label: 'Orders', type: 'table' };
const terms = ['Account', 'Branch', 'Customer', 'Employee'].map((label) => ({
  id: label,
  label,
  type: 'glossaryTerm',
}));
const data = {
  nodes: [root, ...terms],
  edges: terms.map((term) => ({
    from: root.id,
    to: term.id,
    label: 'Has glossary term',
    relationType: 'hasGlossaryTerm',
  })),
};

const Harness = ({ initial }: { initial: (id: string) => GraphSelection }) => {
  const presented = buildGraphPresentation(
    data,
    data,
    root.id,
    'balanced',
    []
  ).data;
  const group = presented.nodes.find((node) => node.presentation?.members);
  const [selection, setSelection] = useState<GraphSelection>(
    initial(group?.id ?? '')
  );
  // Same scene the explorer hands the overlays: raw nodes + group nodes, and
  // the original edges alongside the bundled ones.
  const edges = [
    ...transformToG6Format(data).edges,
    ...transformToG6Format(presented).edges,
  ];

  const accountEdge = edges.find(
    (edge) => edge.target === 'Account' && !edge.data.members
  );

  return (
    <ThemeProvider>
      <button
        type="button"
        onClick={() => setSelection({ kind: 'node', id: root.id })}>
        select root on canvas
      </button>
      <button
        type="button"
        onClick={() =>
          setSelection({ kind: 'edge', id: String(accountEdge?.id) })
        }>
        select account edge on canvas
      </button>
      <KnowledgeGraphOverlays
        edges={[...new Map(edges.map((edge) => [edge.id, edge])).values()]}
        nodes={[...data.nodes, ...(group ? [group] : [])]}
        selection={selection}
        tooltip={null}
        onSelectionChange={setSelection}
      />
    </ThemeProvider>
  );
};

it('offers a way back to the group after drilling into one of its relationships', async () => {
  render(<Harness initial={(groupId) => ({ kind: 'node', id: groupId })} />);

  expect(screen.queryByTestId('inspector-back')).not.toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: 'Orders Has glossary term Account' })
  );

  expect(screen.getByText('label.relationship')).toBeVisible();

  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 3 })).toHaveFocus()
  );

  await userEvent.click(screen.getByTestId('inspector-back'));

  expect(screen.getByText(/label.kg-bundle-subtitle/)).toBeVisible();

  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 3 })).toHaveFocus()
  );

  expect(screen.queryByTestId('inspector-back')).not.toBeInTheDocument();
});

// Stands in for KnowledgeGraph's fullscreen wrapper, which dismisses on Escape
// through react-aria's useOverlay.
const InFullscreen = ({ onExit }: { onExit: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay({ isOpen: true, onClose: onExit }, ref);

  return (
    <div {...overlayProps} ref={ref}>
      <Harness initial={() => null} />
    </div>
  );
};

it('closes only the inspector on Escape inside it, even after other keys', async () => {
  const onExit = jest.fn();
  render(<InFullscreen onExit={onExit} />);
  // Fullscreen is already open when the user selects a node, as in the app.
  await userEvent.click(
    screen.getByRole('button', { name: 'select root on canvas' })
  );

  await userEvent.click(screen.getByRole('heading', { level: 3 }));
  await userEvent.keyboard('{Tab}');
  await userEvent.keyboard('{Escape}');

  expect(screen.queryByTestId('graph-inspector')).not.toBeInTheDocument();
  expect(onExit).not.toHaveBeenCalled();
});

it('still exits fullscreen on Escape when focus is outside the open inspector', async () => {
  const onExit = jest.fn();
  render(<InFullscreen onExit={onExit} />);
  await userEvent.click(
    screen.getByRole('button', { name: 'select root on canvas' })
  );

  expect(screen.getByTestId('graph-inspector')).toBeInTheDocument();

  screen.getByRole('button', { name: 'select root on canvas' }).focus();
  await userEvent.keyboard('{Escape}');

  expect(onExit).toHaveBeenCalledTimes(1);
});

it('lists every relationship in the drawer when "view all" is pressed', async () => {
  render(<Harness initial={() => ({ kind: 'node', id: root.id })} />);
  const rows = () => screen.getAllByRole('button', { name: /^Orders / });

  expect(rows()).toHaveLength(3);

  await userEvent.click(
    screen.getByRole('button', { name: 'label.kg-view-all-relationships' })
  );

  expect(rows()).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'label.view-less' })).toBeVisible();
});

it('drops the way back once the user leaves the relationship', async () => {
  render(<Harness initial={(groupId) => ({ kind: 'node', id: groupId })} />);

  await userEvent.click(
    screen.getByRole('button', { name: 'Orders Has glossary term Account' })
  );

  expect(screen.getByTestId('inspector-back')).toBeVisible();

  await userEvent.click(
    screen.getByRole('button', { name: 'select root on canvas' })
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'select account edge on canvas' })
  );

  expect(screen.getByText('label.relationship')).toBeVisible();
  expect(screen.queryByTestId('inspector-back')).not.toBeInTheDocument();
});

it('expands at most 40 relationships in the drawer and hands larger sets to the paged list', async () => {
  const columns = Array.from({ length: 45 }, (_, index) => ({
    id: 'c' + index,
    label: 'col_' + index,
    type: 'column',
  }));
  const wide = {
    nodes: [root, ...columns],
    edges: columns.map((column) => ({
      from: root.id,
      to: column.id,
      label: 'Has column',
      relationType: 'hasColumn',
    })),
  };
  const onViewRelationships = jest.fn();
  render(
    <ThemeProvider>
      <KnowledgeGraphOverlays
        edges={transformToG6Format(wide).edges}
        nodes={wide.nodes}
        selection={{ kind: 'node', id: root.id }}
        tooltip={null}
        onSelectionChange={jest.fn()}
        onViewRelationships={onViewRelationships}
      />
    </ThemeProvider>
  );

  await userEvent.click(
    screen.getByRole('button', { name: 'label.kg-view-all-relationships' })
  );

  expect(screen.getAllByRole('button', { name: /^Orders / })).toHaveLength(40);

  await userEvent.click(
    screen.getByRole('button', { name: 'label.kg-view-in-list' })
  );

  expect(onViewRelationships).toHaveBeenCalledWith(undefined, {
    label: 'Orders',
    edgeIds: expect.any(Array),
  });
  expect(onViewRelationships.mock.calls[0][1].edgeIds).toHaveLength(45);
});

it('returns to the expanded relationship list after drilling into one of its rows', async () => {
  render(<Harness initial={() => ({ kind: 'node', id: root.id })} />);
  const rows = () => screen.getAllByRole('button', { name: /^Orders / });

  await userEvent.click(
    screen.getByRole('button', { name: 'label.kg-view-all-relationships' })
  );
  await userEvent.click(rows()[3]);
  await userEvent.click(screen.getByTestId('inspector-back'));

  expect(rows()).toHaveLength(4);
});
