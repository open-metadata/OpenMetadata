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
  computeHighlight,
  computeLinkHighlight,
  idOf,
  linkKey,
  viewGraph,
} from './KnowledgeGraph3D.utils';
import { Graph3DData, GraphLink3D, GraphNode3D } from './types';

const makeNode = (overrides: Partial<GraphNode3D>): GraphNode3D => ({
  id: 'N',
  name: 'Node',
  type: 'table',
  levels: ['asset'],
  ...overrides,
});

const makeLink = (overrides: Partial<GraphLink3D>): GraphLink3D => ({
  source: 'A',
  target: 'B',
  label: 'relates',
  kind: 'technical',
  levels: ['asset'],
  ...overrides,
});

describe('idOf', () => {
  it('returns the string endpoint as-is', () => {
    expect(idOf('T1')).toBe('T1');
  });

  it('returns the id from an object endpoint', () => {
    expect(idOf({ id: 'C1' } as unknown as GraphNode3D)).toBe('C1');
  });
});

describe('viewGraph', () => {
  it('keeps only nodes whose levels include the requested level', () => {
    const table = makeNode({
      id: 'T1',
      type: 'table',
      levels: ['asset', 'product', 'domain'],
    });
    const column = makeNode({ id: 'C1', type: 'column', levels: ['asset'] });
    const graph: Graph3DData = { nodes: [table, column], links: [] };

    const result = viewGraph(graph, 'product', 'all');

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('T1');
  });

  it('keeps a link only when both endpoints survive, the level matches and the lens matches', () => {
    const table = makeNode({
      id: 'T1',
      type: 'table',
      levels: ['asset', 'product'],
    });
    const column = makeNode({ id: 'C1', type: 'column', levels: ['asset'] });
    const graph: Graph3DData = {
      nodes: [table, column],
      links: [
        makeLink({
          source: 'T1',
          target: 'C1',
          kind: 'technical',
          levels: ['asset', 'product'],
        }),
      ],
    };

    const atAsset = viewGraph(graph, 'asset', 'all');

    expect(atAsset.links).toHaveLength(1);

    const atProduct = viewGraph(graph, 'product', 'all');

    expect(atProduct.links).toHaveLength(0);
  });

  it('drops a link whose level does not match even if both endpoints survive', () => {
    const a = makeNode({ id: 'A', levels: ['asset', 'product'] });
    const b = makeNode({ id: 'B', levels: ['asset', 'product'] });
    const graph: Graph3DData = {
      nodes: [a, b],
      links: [makeLink({ source: 'A', target: 'B', levels: ['asset'] })],
    };

    const result = viewGraph(graph, 'product', 'all');

    expect(result.links).toHaveLength(0);
  });

  it('drops a link whose kind does not match the focused lens', () => {
    const a = makeNode({ id: 'A', levels: ['asset'] });
    const b = makeNode({ id: 'B', levels: ['asset'] });
    const graph: Graph3DData = {
      nodes: [a, b],
      links: [
        makeLink({
          source: 'A',
          target: 'B',
          kind: 'technical',
          levels: ['asset'],
        }),
      ],
    };

    const result = viewGraph(graph, 'asset', 'ontology');

    expect(result.links).toHaveLength(0);
  });

  it('prunes nodes with no surviving link in a focused lens', () => {
    const a = makeNode({ id: 'A', levels: ['asset'] });
    const b = makeNode({ id: 'B', levels: ['asset'] });
    const orphan = makeNode({ id: 'ORPHAN', levels: ['asset'] });
    const graph: Graph3DData = {
      nodes: [a, b, orphan],
      links: [
        makeLink({
          source: 'A',
          target: 'B',
          kind: 'ontology',
          levels: ['asset'],
        }),
      ],
    };

    const result = viewGraph(graph, 'asset', 'ontology');

    expect(result.nodes.map((node) => node.id).sort()).toEqual(['A', 'B']);
  });

  it('does not prune orphan nodes in lens "all"', () => {
    const a = makeNode({ id: 'A', levels: ['asset'] });
    const b = makeNode({ id: 'B', levels: ['asset'] });
    const orphan = makeNode({ id: 'ORPHAN', levels: ['asset'] });
    const graph: Graph3DData = {
      nodes: [a, b, orphan],
      links: [makeLink({ source: 'A', target: 'B', levels: ['asset'] })],
    };

    const result = viewGraph(graph, 'asset', 'all');

    expect(result.nodes).toHaveLength(3);
  });

  it('preserves node and link object identity (no cloning)', () => {
    const table = makeNode({
      id: 'T1',
      type: 'table',
      levels: ['asset', 'product'],
    });
    const column = makeNode({ id: 'C1', type: 'column', levels: ['asset'] });
    const link = makeLink({ source: 'T1', target: 'C1', levels: ['asset'] });
    const graph: Graph3DData = { nodes: [table, column], links: [link] };

    const result = viewGraph(graph, 'asset', 'all');

    expect(result.nodes[0]).toBe(table);
    expect(result.nodes[1]).toBe(column);
    expect(result.links[0]).toBe(link);
  });
});

describe('computeHighlight', () => {
  it('returns the node, its direct neighbors and incident links for string endpoints', () => {
    const ab = makeLink({ source: 'T1', target: 'C1', label: 'has' });
    const bc = makeLink({ source: 'T1', target: 'C2', label: 'has' });
    const other = makeLink({ source: 'X', target: 'Y', label: 'rel' });

    const result = computeHighlight([ab, bc, other], 'T1');

    expect([...result.nodes].sort()).toEqual(['C1', 'C2', 'T1']);
    expect(result.links.has(ab)).toBe(true);
    expect(result.links.has(bc)).toBe(true);
    expect(result.links.has(other)).toBe(false);
  });

  it('handles object endpoints (post force-sim source/target are node objects)', () => {
    const link = makeLink({
      source: { id: 'T1' } as unknown as string,
      target: { id: 'C1' } as unknown as string,
      label: 'has',
    });

    const result = computeHighlight([link], 'T1');

    expect([...result.nodes].sort()).toEqual(['C1', 'T1']);
    expect(result.links.has(link)).toBe(true);
  });
});

describe('linkKey', () => {
  it('builds "source|target|label" for string endpoints', () => {
    const link = makeLink({ source: 'T1', target: 'C1', label: 'has' });

    expect(linkKey(link)).toBe('T1|C1|has');
  });

  it('builds "source|target|label" for object endpoints', () => {
    const link = makeLink({
      source: { id: 'T1' } as unknown as string,
      target: { id: 'C1' } as unknown as string,
      label: 'has',
    });

    expect(linkKey(link)).toBe('T1|C1|has');
  });
});

describe('computeLinkHighlight', () => {
  it('returns the matching link and its two endpoint ids', () => {
    const match = makeLink({ source: 'T1', target: 'C1', label: 'has' });
    const other = makeLink({ source: 'T1', target: 'C2', label: 'has' });

    const result = computeLinkHighlight([match, other], 'T1|C1|has');

    expect([...result.nodes].sort()).toEqual(['C1', 'T1']);
    expect(result.links.has(match)).toBe(true);
    expect(result.links.has(other)).toBe(false);
  });

  it('returns empty sets when no link matches the key', () => {
    const link = makeLink({ source: 'T1', target: 'C1', label: 'has' });

    const result = computeLinkHighlight([link], 'NOPE|NOPE|none');

    expect(result.nodes.size).toBe(0);
    expect(result.links.size).toBe(0);
  });
});
