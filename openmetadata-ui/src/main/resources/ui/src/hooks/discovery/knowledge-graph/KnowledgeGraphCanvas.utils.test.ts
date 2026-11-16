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

import type { EdgeData, NodeData } from '@antv/g6';
import {
  displayedNodeId,
  getContextEdgeStyle,
  isEdgeLabelVisible,
  matchesSelection,
  selectionSurvives,
} from './KnowledgeGraphCanvas.utils';

const node = (id: string, data: Record<string, unknown> = {}): NodeData => ({
  id,
  data,
});

const edge = (
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {}
): EdgeData => ({ id, source, target, data });

describe('KnowledgeGraphCanvas.utils', () => {
  describe('matchesSelection', () => {
    it('matches an edge selection by id', () => {
      expect(
        matchesSelection(edge('e1', 'a', 'b'), { kind: 'edge', id: 'e1' })
      ).toBe(true);
      expect(
        matchesSelection(edge('e1', 'a', 'b'), { kind: 'edge', id: 'e2' })
      ).toBe(false);
    });

    it('matches an edge selection by member id', () => {
      const bundle = edge('bundle', 'a', 'b', {
        members: [{ id: 'e1' }, { id: 'e2' }],
      });

      expect(matchesSelection(bundle, { kind: 'edge', id: 'e1' })).toBe(true);
      expect(matchesSelection(bundle, { kind: 'edge', id: 'e9' })).toBe(false);
    });

    it('matches a category selection', () => {
      expect(
        matchesSelection(edge('e1', 'a', 'b', { category: 'ownership' }), {
          kind: 'category',
          category: 'ownership',
        })
      ).toBe(true);
    });

    it('matches a node selection when either endpoint is the node', () => {
      expect(
        matchesSelection(edge('e1', 'a', 'b'), { kind: 'node', id: 'a' })
      ).toBe(true);
      expect(
        matchesSelection(edge('e1', 'a', 'b'), { kind: 'node', id: 'z' })
      ).toBe(false);
    });
  });

  describe('selectionSurvives', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('e1', 'a', 'b')];

    it('returns true when there is no selection', () => {
      expect(selectionSurvives(null, nodes, edges)).toBe(true);
    });

    it('returns true when the selected node is still present', () => {
      expect(selectionSurvives({ kind: 'node', id: 'a' }, nodes, edges)).toBe(
        true
      );
    });

    it('returns false when the selected node disappeared', () => {
      expect(
        selectionSurvives({ kind: 'node', id: 'gone' }, nodes, edges)
      ).toBe(false);
    });

    it('finds a member id inside a group node', () => {
      const grouped = [
        node('grp', { presentation: { members: [{ id: 'a' }] } }),
      ];

      expect(displayedNodeId(grouped, 'a')).toBe('grp');
      expect(selectionSurvives({ kind: 'node', id: 'a' }, grouped, [])).toBe(
        true
      );
    });

    it('returns true when the selected edge is still present', () => {
      expect(selectionSurvives({ kind: 'edge', id: 'e1' }, nodes, edges)).toBe(
        true
      );
    });

    it('returns false when the selected edge is gone', () => {
      expect(
        selectionSurvives({ kind: 'edge', id: 'gone' }, nodes, edges)
      ).toBe(false);
    });
  });

  describe('isEdgeLabelVisible', () => {
    const context = { direct: false, selected: false, groupSelected: false };
    const someEdge = edge('e1', 'a', 'b');

    it('always shows labels when mode is "all"', () => {
      expect(isEdgeLabelVisible('all', someEdge, context)).toBe(true);
    });

    it('never shows labels when mode is "none"', () => {
      expect(isEdgeLabelVisible('none', someEdge, context)).toBe(false);
    });

    it('hides presentation-only bundle edges when the group is selected', () => {
      const bundle = edge('e1', 'a', 'b', { presentationOnly: true });

      expect(
        isEdgeLabelVisible('auto', bundle, { ...context, groupSelected: true })
      ).toBe(false);
    });

    it('shows direct edges under "auto"', () => {
      expect(
        isEdgeLabelVisible('auto', someEdge, { ...context, direct: true })
      ).toBe(true);
    });

    it('shows selected edges under "auto"', () => {
      expect(
        isEdgeLabelVisible('auto', someEdge, { ...context, selected: true })
      ).toBe(true);
    });
  });

  describe('getContextEdgeStyle', () => {
    const map = new Map<string, NodeData>([
      ['a', node('a', { presentation: { level: 1 } })],
      ['b', node('b', { presentation: { level: 2 } })],
    ]);
    const someEdge = edge('e1', 'a', 'b');

    it('dims non-branch edges under lanes with no active selection', () => {
      const style = getContextEdgeStyle(someEdge, map, 'lanes', false, 2);

      expect(style.strokeOpacity).toBe(0.3);
      expect(style.lineWidth).toBe(1);
    });

    it('keeps full opacity when a selection exists (dimming handled elsewhere)', () => {
      const style = getContextEdgeStyle(someEdge, map, 'lanes', true, 2);

      expect(style.strokeOpacity).toBe(1);
      expect(style.lineWidth).toBe(2);
    });

    it('keeps full opacity for non-lanes layouts', () => {
      const style = getContextEdgeStyle(someEdge, map, 'radial', false, 2);

      expect(style.strokeOpacity).toBe(1);
      expect(style.lineWidth).toBe(2);
    });

    it('keeps full opacity for branch edges rooted at the node', () => {
      const rooted = new Map<string, NodeData>([
        ['a', node('a', { presentation: { root: true } })],
        ['b', node('b', {})],
      ]);
      const style = getContextEdgeStyle(someEdge, rooted, 'lanes', false, 2);

      expect(style.strokeOpacity).toBe(1);
    });
  });
});
