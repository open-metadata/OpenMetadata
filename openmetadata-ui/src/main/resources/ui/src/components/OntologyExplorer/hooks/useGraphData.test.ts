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
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement, Fragment } from 'react';
import {
  ThemeProvider,
  useTheme,
} from '../../../context/UntitledUIThemeProvider/theme-provider';
import { GlossaryTermRelationType } from '../../../rest/settingConfigAPI';
import { LayoutEngine, LayoutType } from '../OntologyExplorer.constants';
import {
  BuildGraphDataProps,
  OntologyEdge,
  OntologyNode,
} from '../OntologyExplorer.interface';
import { mergeEdges, useGraphDataBuilder } from './useGraphData';

const customRelationType = (
  overrides: Partial<GlossaryTermRelationType> & { name: string }
): GlossaryTermRelationType =>
  ({
    category: 'associative',
    displayName: overrides.name,
    ...overrides,
  } as GlossaryTermRelationType);

const edge = (
  from: string,
  to: string,
  relationType: string
): OntologyEdge => ({ from, to, label: relationType, relationType });

const graphNode = (id: string): OntologyNode => ({
  id,
  label: id,
  type: 'glossaryTerm',
});

const mockComputedStyle = (color: string): CSSStyleDeclaration =>
  ({
    backgroundColor: color,
    getPropertyValue: () => '',
  } as unknown as CSSStyleDeclaration);

const GRAPH_THEME_STORAGE_KEY = 'ontology-graph-theme-test';
let setGraphTheme: ReturnType<typeof useTheme>['setTheme'] | undefined;

const ThemeCapture = () => {
  setGraphTheme = useTheme().setTheme;

  return null;
};

const GraphThemeProvider = ({ children }: { children: ReactNode }) =>
  createElement(ThemeProvider, {
    children: createElement(
      Fragment,
      null,
      createElement(ThemeCapture),
      children
    ),
    storageKey: GRAPH_THEME_STORAGE_KEY,
  });

const renderGraphData = (props: BuildGraphDataProps) =>
  renderHook(() => useGraphDataBuilder(props), {
    wrapper: GraphThemeProvider,
  });

// Mirrors the subset of GlossaryTermRelationSettings the backend seeds via the
// 1.13.0 migration that the tests below exercise.
const seededRelationTypes: GlossaryTermRelationType[] = [
  customRelationType({ name: 'relatedTo', isSymmetric: true }),
  customRelationType({ name: 'synonym', isSymmetric: true }),
  customRelationType({ name: 'partOf', inverseRelation: 'hasPart' }),
  customRelationType({ name: 'hasPart', inverseRelation: 'partOf' }),
];

describe('theme-aware graph data', () => {
  beforeEach(() => {
    localStorage.setItem(GRAPH_THEME_STORAGE_KEY, 'light');
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    localStorage.removeItem(GRAPH_THEME_STORAGE_KEY);
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.style.colorScheme = '';
    setGraphTheme = undefined;
    jest.restoreAllMocks();
  });

  it('rebuilds resolved canvas styles when the active theme changes', () => {
    jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() =>
        mockComputedStyle(
          document.documentElement.classList.contains('dark-mode')
            ? 'rgb(12, 14, 18)'
            : 'rgb(255, 255, 255)'
        )
      );
    const { result } = renderGraphData({
      clickedEdgeId: null,
      explorationMode: 'model',
      glossaries: [],
      glossaryColorMap: {},
      inputEdges: [edge('A', 'B', 'unmappedRelation')],
      inputNodes: [graphNode('A'), graphNode('B')],
      layoutType: LayoutEngine.Dagre,
      selectedNodeId: null,
      settings: { layout: LayoutType.Hierarchical, showEdgeLabels: true },
    });

    expect(result.current.graphData.nodes?.[0]?.style?.fill).toBe(
      'rgb(255, 255, 255)'
    );
    expect(result.current.graphData.edges?.[0]?.style?.stroke).toBe(
      'rgb(255, 255, 255)'
    );

    act(() => setGraphTheme?.('dark'));

    expect(result.current.graphData.nodes?.[0]?.style?.fill).toBe(
      'rgb(12, 14, 18)'
    );
    expect(result.current.graphData.edges?.[0]?.style?.stroke).toBe(
      'rgb(12, 14, 18)'
    );
  });
});

describe('mergeEdges', () => {
  it('merges a symmetric pair (relatedTo + relatedTo) into one bidirectional edge', () => {
    const result = mergeEdges(
      [edge('A', 'B', 'relatedTo'), edge('B', 'A', 'relatedTo')],
      seededRelationTypes
    );

    expect(result).toEqual([
      {
        from: 'A',
        to: 'B',
        relationType: 'relatedTo',
        isBidirectional: true,
      },
    ]);
  });

  it('merges an inverse pair (partOf + hasPart) into one bidirectional edge with both labels', () => {
    const result = mergeEdges(
      [edge('A', 'B', 'partOf'), edge('B', 'A', 'hasPart')],
      seededRelationTypes
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      from: 'A',
      to: 'B',
      relationType: 'partOf',
      inverseRelationType: 'hasPart',
      isBidirectional: true,
    });
  });

  it('keeps multiple distinct relation pairs between the same nodes as separate merged edges', () => {
    const result = mergeEdges(
      [
        edge('A', 'B', 'relatedTo'),
        edge('B', 'A', 'relatedTo'),
        edge('A', 'B', 'partOf'),
        edge('B', 'A', 'hasPart'),
      ],
      seededRelationTypes
    );

    expect(result).toHaveLength(2);

    const relationTypes = result.map((e) => e.relationType).sort();

    expect(relationTypes).toEqual(['partOf', 'relatedTo']);
    expect(result.every((e) => e.isBidirectional)).toBe(true);
  });

  it('keeps a single-direction edge unidirectional', () => {
    const result = mergeEdges([edge('A', 'B', 'partOf')], seededRelationTypes);

    expect(result).toEqual([
      {
        from: 'A',
        to: 'B',
        relationType: 'partOf',
        isBidirectional: false,
      },
    ]);
  });

  it('does not merge two edges of the same non-symmetric relation type', () => {
    const result = mergeEdges(
      [edge('A', 'B', 'partOf'), edge('B', 'A', 'partOf')],
      seededRelationTypes
    );

    expect(result).toHaveLength(2);
    expect(result.every((e) => e.isBidirectional === false)).toBe(true);
  });

  it('merges a user-configured inverse pair using runtime relation type settings', () => {
    const configuredTypes: GlossaryTermRelationType[] = [
      customRelationType({ name: 'derivedFrom', inverseRelation: 'derives' }),
      customRelationType({ name: 'derives', inverseRelation: 'derivedFrom' }),
    ];
    const result = mergeEdges(
      [edge('A', 'B', 'derivedFrom'), edge('B', 'A', 'derives')],
      configuredTypes
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      from: 'A',
      to: 'B',
      relationType: 'derivedFrom',
      inverseRelationType: 'derives',
      isBidirectional: true,
    });
  });

  it('merges a user-configured symmetric relation type from runtime settings', () => {
    const configuredTypes: GlossaryTermRelationType[] = [
      customRelationType({ name: 'siblingOf', isSymmetric: true }),
    ];
    const result = mergeEdges(
      [edge('A', 'B', 'siblingOf'), edge('B', 'A', 'siblingOf')],
      configuredTypes
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      from: 'A',
      to: 'B',
      relationType: 'siblingOf',
      isBidirectional: true,
    });
  });

  it('infers the reverse inverse mapping when only one direction is configured', () => {
    const configuredTypes: GlossaryTermRelationType[] = [
      customRelationType({ name: 'producedBy', inverseRelation: 'produces' }),
    ];
    const result = mergeEdges(
      [edge('A', 'B', 'producedBy'), edge('B', 'A', 'produces')],
      configuredTypes
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      from: 'A',
      to: 'B',
      relationType: 'producedBy',
      inverseRelationType: 'produces',
      isBidirectional: true,
    });
  });

  it('renders edges as unidirectional when no relation type settings are provided (fail-safe)', () => {
    // Without backend settings (e.g. fetch failure), we do not guess inverse
    // semantics — every edge stays unidirectional. Same data still renders.
    const result = mergeEdges([
      edge('A', 'B', 'partOf'),
      edge('B', 'A', 'hasPart'),
    ]);

    expect(result).toHaveLength(2);
    expect(result.every((e) => e.isBidirectional === false)).toBe(true);
  });

  it('leaves an unknown relation type unidirectional when not in settings', () => {
    const result = mergeEdges(
      [
        edge('A', 'B', 'somethingCustom'),
        edge('B', 'A', 'somethingElseCustom'),
      ],
      seededRelationTypes
    );

    expect(result).toHaveLength(2);
    expect(result.every((e) => e.isBidirectional === false)).toBe(true);
  });
});
