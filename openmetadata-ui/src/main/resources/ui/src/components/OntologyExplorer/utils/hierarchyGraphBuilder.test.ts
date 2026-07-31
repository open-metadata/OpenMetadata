/*
 *  Copyright 2025 Collate.
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
import { OntologyEdge, OntologyNode } from '../OntologyExplorer.interface';
import { buildHierarchyGraphs } from './hierarchyGraphBuilder';

const RELATION_COLORS = { broader: '#000' };

function term(id: string, glossaryId: string, group?: string): OntologyNode {
  return {
    id,
    label: id,
    type: 'glossaryTerm',
    glossaryId,
    group,
  };
}

function edge(from: string, to: string): OntologyEdge {
  return { from, to, label: 'Broader', relationType: 'broader' };
}

describe('buildHierarchyGraphs combo label resolution', () => {
  const parent = term('parent', 'gloss-id', 'Pharmaceuticals');
  const child = term('child', 'gloss-id', 'Pharmaceuticals');
  const terms = [parent, child];
  const relations = [edge('parent', 'child')];

  it('uses the glossary name from glossaryNames when available', () => {
    const result = buildHierarchyGraphs({
      terms,
      relations,
      relationSettings: null,
      relationColors: RELATION_COLORS,
      glossaryNames: { 'gloss-id': 'Pharmaceuticals' },
    });

    expect(result.combos).toHaveLength(1);
    expect(result.combos[0].label).toBe('Pharmaceuticals');
  });

  it('falls back to node.group when glossaryNames lookup misses', () => {
    // Simulates the prod scenario where a term belongs to a glossary the
    // caller cannot see (permission gap, RDF-vs-DB inconsistency, etc.):
    // the per-term `group` field carried by the RDF response must rescue
    // the combo label so it never falls through to the raw UUID.
    const result = buildHierarchyGraphs({
      terms,
      relations,
      relationSettings: null,
      relationColors: RELATION_COLORS,
      glossaryNames: {}, // caller cannot resolve gloss-id
    });

    expect(result.combos).toHaveLength(1);
    expect(result.combos[0].label).toBe('Pharmaceuticals');
    expect(result.combos[0].label).not.toBe('gloss-id');
  });

  it('falls through to the raw glossaryId only when both lookups fail', () => {
    const termsNoGroup = [
      term('parent', 'gloss-id'),
      term('child', 'gloss-id'),
    ];

    const result = buildHierarchyGraphs({
      terms: termsNoGroup,
      relations,
      relationSettings: null,
      relationColors: RELATION_COLORS,
      glossaryNames: {},
    });

    expect(result.combos).toHaveLength(1);
    expect(result.combos[0].label).toBe('gloss-id');
  });

  it('ignores blank `group` strings when picking the fallback', () => {
    const blankGroupTerms = [
      term('parent', 'gloss-id', ''),
      term('child', 'gloss-id', 'Pharmaceuticals'),
    ];

    const result = buildHierarchyGraphs({
      terms: blankGroupTerms,
      relations,
      relationSettings: null,
      relationColors: RELATION_COLORS,
      glossaryNames: {},
    });

    expect(result.combos[0].label).toBe('Pharmaceuticals');
  });
});
