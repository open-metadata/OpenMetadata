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
import { OntologyGraphData } from '../OntologyExplorer.interface';
import { buildStudioGraphScope } from './studioFocusedGraph';

const chain = (count: number): OntologyGraphData => ({
  nodes: Array.from({ length: count }, (_, index) => ({
    id: `n${index}`,
    label: `Concept ${String(index).padStart(4, '0')}`,
    type: 'ontologyConcept',
  })),
  edges: Array.from({ length: count - 1 }, (_, index) => ({
    from: `n${index + 1}`,
    to: `n${index}`,
    label: 'is a',
    relationType: 'subClassOf',
  })),
});

describe('buildStudioGraphScope', () => {
  it('returns the whole graph at or below the limit', () => {
    const graph = chain(500);

    const scope = buildStudioGraphScope(graph, { seedIds: [] });

    expect(scope.isFocused).toBe(false);
    expect(scope.graph).toBe(graph);
    expect(scope.shownCount).toBe(500);
  });

  it('shows nothing until a concept is chosen above the limit', () => {
    const scope = buildStudioGraphScope(chain(2000), { seedIds: [] });

    expect(scope.isFocused).toBe(true);
    expect(scope.totalCount).toBe(2000);
    expect(scope.shownCount).toBe(0);
    expect(scope.graph.nodes).toEqual([]);
  });

  it('shows the selected concept and its neighbours two hops out', () => {
    const scope = buildStudioGraphScope(chain(2000), { seedIds: ['n100'] });

    expect(scope.graph.nodes.map(({ id }) => id)).toEqual([
      'n98',
      'n99',
      'n100',
      'n101',
      'n102',
    ]);
    expect(scope.graph.edges).toHaveLength(4);
    expect(scope.totalCount).toBe(2000);
  });

  it('keeps every seed from a search and drops edges that leave the view', () => {
    const scope = buildStudioGraphScope(chain(600), {
      seedIds: ['n10', 'n400'],
    });

    const ids = scope.graph.nodes.map(({ id }) => id);

    expect(ids).toEqual(
      expect.arrayContaining(['n10', 'n9', 'n11', 'n400', 'n399', 'n401'])
    );
    expect(ids).not.toContain('n200');

    scope.graph.edges.forEach(({ from, to }) => {
      expect(ids).toEqual(expect.arrayContaining([from, to]));
    });
  });

  it('caps a hub with thousands of neighbours', () => {
    const hub: OntologyGraphData = {
      nodes: [
        { id: 'hub', label: 'Hub', type: 'ontologyConcept' },
        ...Array.from({ length: 800 }, (_, index) => ({
          id: `s${index}`,
          label: `Spoke ${String(index).padStart(4, '0')}`,
          type: 'ontologyConcept',
        })),
      ],
      edges: Array.from({ length: 800 }, (_, index) => ({
        from: `s${index}`,
        to: 'hub',
        label: 'is a',
        relationType: 'subClassOf',
      })),
    };

    const scope = buildStudioGraphScope(hub, { seedIds: ['hub'] });

    expect(scope.shownCount).toBe(120);
    expect(scope.graph.nodes[0].id).toBe('hub');
  });

  it('ignores seeds that are not in the graph', () => {
    const scope = buildStudioGraphScope(chain(600), { seedIds: ['gone'] });

    expect(scope.shownCount).toBe(0);
  });
});
