/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { calculateStudioNodePositions } from './studioGraphLayout';

describe('calculateStudioNodePositions', () => {
  it('lays connected nodes out from left to right without overlap', async () => {
    const positions = await calculateStudioNodePositions(
      [{ id: 'root' }, { id: 'child-a' }, { id: 'child-b' }],
      [
        { id: 'edge-a', source: 'root', target: 'child-a' },
        { id: 'edge-b', source: 'root', target: 'child-b' },
      ]
    );

    expect(positions.root.x).toBeLessThan(positions['child-a'].x);
    expect(positions.root.x).toBeLessThan(positions['child-b'].x);
    expect(
      new Set(Object.values(positions).map(({ x, y }) => `${x}:${y}`)).size
    ).toBe(3);
  });

  it('places isolated terms below the connected graph', async () => {
    const positions = await calculateStudioNodePositions(
      [{ id: 'root' }, { id: 'child' }, { id: 'isolated' }],
      [{ id: 'edge', source: 'root', target: 'child' }]
    );

    expect(positions.isolated.y).toBeGreaterThan(
      Math.max(positions.root.y, positions.child.y)
    );
  });

  it('gives every isolated term a distinct grid position', async () => {
    const positions = await calculateStudioNodePositions(
      Array.from({ length: 6 }, (_, index) => ({ id: `term-${index}` })),
      []
    );

    expect(Object.keys(positions)).toHaveLength(6);
    expect(
      new Set(Object.values(positions).map(({ x, y }) => `${x}:${y}`)).size
    ).toBe(6);
  });

  it('uses hierarchy edges for ranks without letting associative cycles distort them', async () => {
    const positions = await calculateStudioNodePositions(
      [{ id: 'root' }, { id: 'child' }, { id: 'peer' }],
      [
        {
          id: 'hierarchy',
          source: 'root',
          target: 'child',
          data: { relationType: 'parentOf' },
        },
        {
          id: 'related-back',
          source: 'child',
          target: 'root',
          data: { relationType: 'relatedTo' },
        },
        {
          id: 'related-peer',
          source: 'child',
          target: 'peer',
          data: { relationType: 'relatedTo' },
        },
      ]
    );

    expect(positions.root.x).toBeLessThan(positions.child.x);
    expect(positions.child.x).toBeLessThan(positions.peer.x);
  });

  it('normalizes child-to-parent hierarchy relations to parent-first ranks', async () => {
    const positions = await calculateStudioNodePositions(
      [{ id: 'parent' }, { id: 'child' }],
      [
        {
          id: 'broader',
          source: 'child',
          target: 'parent',
          data: { relationType: 'broader' },
        },
      ]
    );

    expect(positions.parent.x).toBeLessThan(positions.child.x);
  });

  it('packs disconnected components inside the requested viewport', async () => {
    const positions = await calculateStudioNodePositions(
      [
        { id: 'a-root' },
        { id: 'a-child' },
        { id: 'b-root' },
        { id: 'b-child' },
      ],
      [
        {
          id: 'a-edge',
          source: 'a-root',
          target: 'a-child',
          data: { relationType: 'parentOf' },
        },
        {
          id: 'b-edge',
          source: 'b-root',
          target: 'b-child',
          data: { relationType: 'parentOf' },
        },
      ],
      { viewportWidth: 700 }
    );

    Object.values(positions).forEach(({ x }) => {
      expect(x).toBeGreaterThanOrEqual(185);
      expect(x).toBeLessThanOrEqual(515);
    });

    expect(positions['b-root'].y).toBeGreaterThan(positions['a-root'].y);
  });

  it('is deterministic when API node and edge order changes', async () => {
    const nodes = [
      { id: 'root', data: { label: 'Root' } },
      { id: 'child-a', data: { label: 'Child A' } },
      { id: 'child-b', data: { label: 'Child B' } },
    ];
    const edges = [
      {
        id: 'edge-a',
        source: 'root',
        target: 'child-a',
        data: { relationType: 'parentOf' },
      },
      {
        id: 'edge-b',
        source: 'root',
        target: 'child-b',
        data: { relationType: 'parentOf' },
      },
    ];

    const first = await calculateStudioNodePositions(nodes, edges);
    const second = await calculateStudioNodePositions(
      [...nodes].reverse(),
      [...edges].reverse()
    );

    expect(second).toEqual(first);
  });

  it('keeps the Studio sample topology compact and overlap-free', async () => {
    const nodeIds = [
      'Anti-Money Laundering',
      'Compliance',
      'Compliance Status',
      'Compliant',
      'Credit Risk',
      'Customer Due Diligence',
      'Expected Loss',
      'Exposure at Default',
      'Know Your Customer',
      'Legacy Risk Code',
      'Loss Given Default',
      'Market Risk',
      'Non-Compliant',
      'Operational Risk',
      'Probability of Default',
      'Risk',
      'Risk Metric',
      'Sanctions Screening',
      'Suspicious Activity Report',
      'Transaction Monitoring',
    ];
    const parentPairs = [
      ['Compliance', 'Anti-Money Laundering'],
      ['Compliance', 'Customer Due Diligence'],
      ['Compliance', 'Know Your Customer'],
      ['Compliance', 'Sanctions Screening'],
      ['Compliance', 'Suspicious Activity Report'],
      ['Compliance', 'Transaction Monitoring'],
      ['Compliance Status', 'Compliant'],
      ['Compliance Status', 'Non-Compliant'],
      ['Risk', 'Credit Risk'],
      ['Risk', 'Market Risk'],
      ['Risk', 'Operational Risk'],
      ['Risk Metric', 'Expected Loss'],
      ['Risk Metric', 'Exposure at Default'],
      ['Risk Metric', 'Loss Given Default'],
      ['Risk Metric', 'Probability of Default'],
    ];
    const semanticRelations = [
      ['Anti-Money Laundering', 'Operational Risk', 'relatedTo'],
      ['Anti-Money Laundering', 'Transaction Monitoring', 'relatedTo'],
      ['Compliance', 'Risk', 'relatedTo'],
      ['Compliant', 'Non-Compliant', 'antonym'],
      ['Credit Risk', 'Risk', 'broader'],
      ['Customer Due Diligence', 'Know Your Customer', 'synonym'],
      ['Expected Loss', 'Probability of Default', 'calculatedFrom'],
      ['Market Risk', 'Risk', 'broader'],
      ['Operational Risk', 'Risk', 'broader'],
      ['Risk Metric', 'Risk', 'relatedTo'],
      ['Sanctions Screening', 'Know Your Customer', 'partOf'],
    ];
    const edges = [
      ...parentPairs.map(([source, target], index) => ({
        id: `parent-${index}`,
        source,
        target,
        data: { relationType: 'parentOf' },
      })),
      ...semanticRelations.map(([source, target, relationType], index) => ({
        id: `semantic-${index}`,
        source,
        target,
        data: { relationType },
      })),
    ];

    const positions = await calculateStudioNodePositions(
      nodeIds.map((id) => ({ id, data: { label: id } })),
      edges,
      { viewportWidth: 1880 }
    );
    const connectedNodeIds = nodeIds.filter(
      (nodeId) => nodeId !== 'Legacy Risk Code'
    );

    connectedNodeIds.forEach((nodeId) => {
      expect(positions[nodeId].x).toBeGreaterThanOrEqual(185);
      expect(positions[nodeId].x).toBeLessThanOrEqual(1695);
    });
    connectedNodeIds.forEach((nodeId, index) => {
      connectedNodeIds.slice(index + 1).forEach((otherNodeId) => {
        const horizontalGap = Math.abs(
          positions[nodeId].x - positions[otherNodeId].x
        );
        const verticalGap = Math.abs(
          positions[nodeId].y - positions[otherNodeId].y
        );

        expect(horizontalGap >= 150 || verticalGap >= 36).toBe(true);
      });
    });

    expect(positions['Legacy Risk Code'].y).toBeGreaterThan(
      Math.max(...connectedNodeIds.map((nodeId) => positions[nodeId].y))
    );
  });
});
