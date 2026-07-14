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
import { renderHook } from '@testing-library/react';
import { Provenance } from '../../../generated/type/termRelation';
import { GlossaryTermRelationType } from '../../../rest/settingConfigAPI';
import { LayoutEngine, LayoutType } from '../OntologyExplorer.constants';
import { OntologyEdge, OntologyNode } from '../OntologyExplorer.interface';
import {
  ASSET_BINDING_EDGE_KIND,
  ASSET_RELATION_TYPE,
  SEMANTIC_PROJECTION_EDGE_KIND,
} from '../utils/graphBuilders';
import {
  getStudioNodeAccentColor,
  mergeEdges,
  useGraphDataBuilder,
} from './useGraphData';

jest.mock('../utils/textMeasure', () => ({
  getCanvasContext: jest.fn(() => null),
  measureTextWidth: jest.fn(
    (text: string, _font: string, fallbackCharWidth: number) =>
      text.length * fallbackCharWidth
  ),
  truncateToFit: jest.fn((text: string) => text),
}));

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

const studioNode = (overrides: Partial<OntologyNode>): OntologyNode => ({
  id: 'term-id',
  label: 'Term',
  type: 'glossaryTerm',
  ...overrides,
});

describe('getStudioNodeAccentColor', () => {
  it('uses the spec warning orange for isolated terms', () => {
    expect(
      getStudioNodeAccentColor(studioNode({ type: 'glossaryTermIsolated' }))
    ).toBe('#F79009');
  });

  it('uses the spec compliance orange for compliance hierarchy terms', () => {
    expect(
      getStudioNodeAccentColor(
        studioNode({
          fullyQualifiedName: 'FinancialRiskCompliance.Compliance.KYC',
        })
      )
    ).toBe('#DC6803');
  });

  it('uses the spec light blue for other connected terms', () => {
    expect(
      getStudioNodeAccentColor(
        studioNode({ fullyQualifiedName: 'FinancialRiskCompliance.Risk' })
      )
    ).toBe('#84CAFF');
  });
});

// Mirrors the subset of GlossaryTermRelationSettings the backend seeds via the
// 1.13.0 migration that the tests below exercise.
const seededRelationTypes: GlossaryTermRelationType[] = [
  customRelationType({ name: 'relatedTo', isSymmetric: true }),
  customRelationType({ name: 'synonym', isSymmetric: true }),
  customRelationType({ name: 'partOf', inverseRelation: 'hasPart' }),
  customRelationType({ name: 'hasPart', inverseRelation: 'partOf' }),
];

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

  it('preserves semantic projection provenance through edge merging', () => {
    const result = mergeEdges(
      [
        {
          ...edge('asset-a', 'asset-b', 'requires'),
          edgeKind: SEMANTIC_PROJECTION_EDGE_KIND,
          provenance: Provenance.Inferred,
        },
      ],
      seededRelationTypes
    );

    expect(result[0]).toMatchObject({
      edgeKind: SEMANTIC_PROJECTION_EDGE_KIND,
      provenance: Provenance.Inferred,
    });
  });
});

describe('useGraphDataBuilder data projection', () => {
  it('keeps inferred asset-to-asset edges visible when both concepts are expanded', () => {
    const { result } = renderHook(() =>
      useGraphDataBuilder({
        inputNodes: [
          { id: 'concept-a', label: 'Concept A', type: 'glossaryTerm' },
          { id: 'concept-b', label: 'Concept B', type: 'glossaryTerm' },
          { id: 'asset-a', label: 'Asset A', type: 'dataAsset' },
          { id: 'asset-b', label: 'Asset B', type: 'dataAsset' },
        ],
        inputEdges: [
          {
            ...edge('asset-a', 'concept-a', ASSET_RELATION_TYPE),
            edgeKind: ASSET_BINDING_EDGE_KIND,
          },
          {
            ...edge('asset-b', 'concept-b', ASSET_RELATION_TYPE),
            edgeKind: ASSET_BINDING_EDGE_KIND,
          },
          {
            ...edge('asset-a', 'asset-b', 'requires'),
            edgeKind: SEMANTIC_PROJECTION_EDGE_KIND,
            provenance: Provenance.Inferred,
          },
        ],
        explorationMode: 'data',
        settings: { layout: LayoutType.Hierarchical, showEdgeLabels: true },
        selectedNodeId: null,
        expandedTermIds: new Set(['concept-a', 'concept-b']),
        clickedEdgeId: null,
        glossaries: [],
        glossaryColorMap: {},
        layoutType: LayoutEngine.Dagre,
      })
    );

    expect(result.current.graphData.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'asset-a',
          target: 'asset-b',
          data: expect.objectContaining({
            edgeKind: SEMANTIC_PROJECTION_EDGE_KIND,
            provenance: Provenance.Inferred,
          }),
          style: expect.objectContaining({ lineDash: [6, 4] }),
        }),
      ])
    );
  });
});
