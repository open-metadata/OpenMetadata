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
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import {
  ChangeType,
  ConceptChange,
  MemberChange,
  MemberKind,
} from '../../../../generated/api/data/ontologyWorkingDiff';
import {
  conceptChangeLabel,
  countChangesByKind,
  countRowsByFilter,
  filterConceptChanges,
  flattenConceptChanges,
  suggestVersion,
} from './OntologyReleaseChanges.utils';

const change = (
  memberKind: MemberKind,
  changeType: ChangeType,
  name = memberKind + changeType
): MemberChange => ({
  memberKind,
  changeType,
  ontologyId: 'ontology',
  entity: { id: name, name, type: 'ontologyConcept' },
});

const group = (
  concept: string | undefined,
  changeType: ChangeType,
  changes: MemberChange[],
  iri?: string
): ConceptChange => ({
  concept,
  iri,
  changeType,
  changes,
  parents: [],
  propertyCount: 0,
});

describe('countChangesByKind', () => {
  it('counts each kind apart and leaves the ontology row out of the total', () => {
    expect(
      countChangesByKind([
        change(MemberKind.Ontology, ChangeType.Added),
        change(MemberKind.Concept, ChangeType.Added, 'a'),
        change(MemberKind.Concept, ChangeType.Changed, 'b'),
        change(MemberKind.Property, ChangeType.Added),
        change(MemberKind.Association, ChangeType.Removed),
        change(MemberKind.Axiom, ChangeType.Added, 'x'),
        change(MemberKind.Shape, ChangeType.Changed),
      ])
    ).toEqual({
      concepts: 2,
      properties: 1,
      relationships: 1,
      rules: 2,
      total: 6,
    });
  });

  it('is all zeros for no changes', () => {
    expect(countChangesByKind([])).toEqual({
      concepts: 0,
      properties: 0,
      relationships: 0,
      rules: 0,
      total: 0,
    });
  });
});

describe('suggestVersion', () => {
  it('suggests the unstable first release and names why', () => {
    expect(
      suggestVersion([change(MemberKind.Concept, ChangeType.Added)], undefined)
    ).toEqual({ bump: VersionBump.Minor, reason: 'first' });
  });

  it('suggests Major for any removal, even beside additions', () => {
    expect(
      suggestVersion(
        [
          change(MemberKind.Concept, ChangeType.Added),
          change(MemberKind.Property, ChangeType.Removed),
        ],
        '1.2.3'
      )
    ).toEqual({ bump: VersionBump.Major, reason: 'removal' });
  });

  it('suggests Minor for additions and Patch for edits only', () => {
    expect(
      suggestVersion([change(MemberKind.Concept, ChangeType.Added)], '1.2.3')
    ).toEqual({ bump: VersionBump.Minor, reason: 'addition' });
    expect(
      suggestVersion([change(MemberKind.Concept, ChangeType.Changed)], '1.2.3')
    ).toEqual({ bump: VersionBump.Patch, reason: 'change' });
  });

  it('ignores the ontology row when it is the only addition', () => {
    expect(
      suggestVersion(
        [
          change(MemberKind.Ontology, ChangeType.Added),
          change(MemberKind.Concept, ChangeType.Changed),
        ],
        '1.0.0'
      )
    ).toEqual({ bump: VersionBump.Patch, reason: 'change' });
  });
});

describe('conceptChangeLabel', () => {
  it('prefers the concept label, then the display name, and uses the IRI tail last', () => {
    expect(
      conceptChangeLabel(
        group(
          'Funds Transfer',
          ChangeType.Added,
          [],
          'urn:x:0c74f640-1111-4222-8333-444455556666'
        )
      )
    ).toBe('Funds Transfer');
    expect(
      conceptChangeLabel(
        group(
          undefined,
          ChangeType.Added,
          [
            {
              ...change(MemberKind.Concept, ChangeType.Added),
              entity: {
                id: 'c',
                name: 'raw',
                displayName: 'Shown',
                type: 'ontologyConcept',
              },
            },
          ],
          'https://example.org/fin#Tail'
        )
      )
    ).toBe('Shown');
    expect(
      conceptChangeLabel(
        group(undefined, ChangeType.Added, [], 'https://example.org/fin#Tail')
      )
    ).toBe('Tail');
  });
});

describe('filtering concept changes', () => {
  const rows = [
    group('Alpha', ChangeType.Added, [
      change(MemberKind.Concept, ChangeType.Added),
    ]),
    group('Beta', ChangeType.Changed, [
      change(MemberKind.Concept, ChangeType.Changed),
    ]),
    group('Gamma', ChangeType.Removed, [
      change(MemberKind.Concept, ChangeType.Removed),
    ]),
    group('Delta', ChangeType.Deprecated, [
      change(MemberKind.Concept, ChangeType.Deprecated),
    ]),
  ];

  it('keeps the rows of the chosen kind of change', () => {
    expect(
      filterConceptChanges(rows, 'added', '').map(conceptChangeLabel)
    ).toEqual(['Alpha']);
    expect(
      filterConceptChanges(rows, 'changed', '').map(conceptChangeLabel)
    ).toEqual(['Beta', 'Delta']);
    expect(
      filterConceptChanges(rows, 'removed', '').map(conceptChangeLabel)
    ).toEqual(['Gamma']);
    expect(filterConceptChanges(rows, 'all', '')).toHaveLength(4);
  });

  it('searches the concept label and its members case-insensitively', () => {
    expect(
      filterConceptChanges(rows, 'all', ' gAm ').map(conceptChangeLabel)
    ).toEqual(['Gamma']);
    expect(filterConceptChanges(rows, 'added', 'gamma')).toEqual([]);
  });
});

describe('flattenConceptChanges', () => {
  it('lists every member change of every group', () => {
    const first = change(MemberKind.Concept, ChangeType.Added, 'a');
    const second = change(MemberKind.Property, ChangeType.Added, 'b');

    expect(
      flattenConceptChanges([
        group('A', ChangeType.Added, [first, second]),
        group(undefined, ChangeType.Changed, []),
      ])
    ).toEqual([first, second]);
  });
});

describe('countRowsByFilter', () => {
  it('counts the rows each filter shows under the current search', () => {
    const groups = [
      group('Alpha', ChangeType.Added, []),
      group('Alpine', ChangeType.Added, []),
      group('Beta', ChangeType.Changed, []),
      group('Gamma', ChangeType.Removed, []),
    ];

    expect(countRowsByFilter(groups, [], '')).toEqual({
      all: 4,
      added: 2,
      changed: 1,
      removed: 1,
    });
    expect(countRowsByFilter(groups, [], 'alp')).toEqual({
      all: 2,
      added: 2,
      changed: 0,
      removed: 0,
    });
  });
});
