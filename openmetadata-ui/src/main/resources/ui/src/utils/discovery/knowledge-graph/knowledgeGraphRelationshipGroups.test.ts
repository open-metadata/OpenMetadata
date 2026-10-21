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

import { groupRelationshipTypeChoices } from './knowledgeGraphRelationshipGroups';

const option = (id: string, count = 1) => ({ id, label: id, count });

describe('groupRelationshipTypeChoices', () => {
  it('groups predicates by their RelationCategory and preserves canonical order', () => {
    const sections = groupRelationshipTypeChoices([
      option('upstream', 3),
      option('hasOwner', 2),
      option('hasTag', 4),
      option('downstream', 1),
    ]);

    expect(sections.map((s) => s.key)).toEqual([
      'lineage',
      'governance',
      'ownership',
    ]);

    const lineage = sections.find((s) => s.key === 'lineage');

    expect(lineage?.choices.map((c) => c.id).sort()).toEqual([
      'downstream',
      'upstream',
    ]);
  });

  it('sums the count of its choices into the section count for header rendering', () => {
    const sections = groupRelationshipTypeChoices([
      option('upstream', 3),
      option('downstream', 7),
      option('hasOwner', 2),
    ]);

    const lineage = sections.find((s) => s.key === 'lineage');
    const ownership = sections.find((s) => s.key === 'ownership');

    expect(lineage?.count).toBe(10);
    expect(ownership?.count).toBe(2);
  });

  it('drops empty groups so the dropdown only lists families present in the graph', () => {
    const sections = groupRelationshipTypeChoices([option('upstream')]);

    expect(sections.map((s) => s.key)).toEqual(['lineage']);
  });

  it('falls back to "other" for predicates the classifier does not recognise', () => {
    const sections = groupRelationshipTypeChoices([
      option('made_up_predicate', 2),
    ]);

    expect(sections.map((s) => s.key)).toEqual(['other']);
  });
});
