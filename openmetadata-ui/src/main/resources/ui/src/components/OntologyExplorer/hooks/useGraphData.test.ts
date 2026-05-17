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
import { GlossaryTermRelationType } from '../../../rest/settingConfigAPI';
import { OntologyEdge } from '../OntologyExplorer.interface';
import { mergeEdges } from './useGraphData';

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

describe('mergeEdges', () => {
  it('merges a symmetric pair (relatedTo + relatedTo) into one bidirectional edge', () => {
    const result = mergeEdges([
      edge('A', 'B', 'relatedTo'),
      edge('B', 'A', 'relatedTo'),
    ]);

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
    const result = mergeEdges([
      edge('A', 'B', 'partOf'),
      edge('B', 'A', 'hasPart'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      from: 'A',
      to: 'B',
      relationType: 'partOf',
      inverseRelationType: 'hasPart',
      isBidirectional: true,
    });
  });

  it('merges an asymmetric inverse pair (composedOf maps to partOf, but partOf maps to hasPart)', () => {
    // INVERSE_RELATION_PAIRS has composedOf -> partOf, but partOf -> hasPart.
    // The bidirectional isInversePair lookup must still detect this case.
    const forward = mergeEdges([
      edge('A', 'B', 'composedOf'),
      edge('B', 'A', 'partOf'),
    ]);

    expect(forward).toHaveLength(1);
    expect(forward[0]).toMatchObject({
      from: 'A',
      to: 'B',
      relationType: 'composedOf',
      inverseRelationType: 'partOf',
      isBidirectional: true,
    });

    const reverse = mergeEdges([
      edge('A', 'B', 'partOf'),
      edge('B', 'A', 'composedOf'),
    ]);

    expect(reverse).toHaveLength(1);
    expect(reverse[0]).toMatchObject({
      from: 'A',
      to: 'B',
      relationType: 'partOf',
      inverseRelationType: 'composedOf',
      isBidirectional: true,
    });
  });

  it('keeps multiple distinct relation pairs between the same nodes as separate merged edges', () => {
    const result = mergeEdges([
      edge('A', 'B', 'relatedTo'),
      edge('B', 'A', 'relatedTo'),
      edge('A', 'B', 'partOf'),
      edge('B', 'A', 'hasPart'),
    ]);

    expect(result).toHaveLength(2);

    const relationTypes = result.map((e) => e.relationType).sort();

    expect(relationTypes).toEqual(['partOf', 'relatedTo']);
    expect(result.every((e) => e.isBidirectional)).toBe(true);
  });

  it('keeps a single-direction edge unidirectional', () => {
    const result = mergeEdges([edge('A', 'B', 'partOf')]);

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
    const result = mergeEdges([
      edge('A', 'B', 'partOf'),
      edge('B', 'A', 'partOf'),
    ]);

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

  it('leaves an unknown custom relation as unidirectional when not in settings', () => {
    const result = mergeEdges([
      edge('A', 'B', 'somethingCustom'),
      edge('B', 'A', 'somethingElseCustom'),
    ]);

    expect(result).toHaveLength(2);
    expect(result.every((e) => e.isBidirectional === false)).toBe(true);
  });
});
