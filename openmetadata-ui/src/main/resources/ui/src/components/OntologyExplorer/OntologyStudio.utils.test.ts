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

import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { GraphFilters, OntologyGraphData } from './OntologyExplorer.interface';
import {
  buildOntologyQuerySuggestions,
  buildOntologyTreeGroups,
  getOntologyHealthSummary,
} from './OntologyStudio.utils';

const FILTERS: GraphFilters = {
  glossaryIds: [],
  relationTypes: [],
  searchQuery: '',
  showCrossGlossaryOnly: false,
  showIsolatedNodes: true,
  viewMode: 'overview',
};

const GLOSSARIES: Glossary[] = [
  { id: 'g1', name: 'Finance', description: '' },
  { id: 'g2', name: 'Compliance', description: '' },
];

const RELATION_TYPES: RelationshipType[] = [
  createRelationshipTypeMock({
    name: 'broader',
    displayName: 'Broader',
    rdfPredicate: 'http://www.w3.org/2004/02/skos/core#broader',
  }),
];

const GRAPH: OntologyGraphData = {
  nodes: [
    {
      id: 'a',
      label: 'Alpha parent',
      type: 'glossaryTerm',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.AlphaParent',
    },
    {
      id: 'b',
      label: 'Beta parent',
      type: 'glossaryTerm',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.BetaParent',
    },
    {
      id: 'c',
      label: 'Child',
      type: 'glossaryTerm',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.Child',
    },
    {
      id: 'd',
      label: 'Detached',
      type: 'glossaryTermIsolated',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.Detached',
    },
    {
      id: 'e',
      label: 'External isolated',
      type: 'glossaryTermIsolated',
      glossaryId: 'g2',
      fullyQualifiedName: 'Compliance.ExternalIsolated',
    },
    { id: 'asset', label: 'Orders', type: 'dataAsset' },
  ],
  edges: [
    { from: 'a', to: 'c', label: 'Parent of', relationType: 'parentOf' },
    { from: 'c', to: 'b', label: 'Broader', relationType: 'broader' },
    {
      from: 'asset',
      to: 'd',
      label: 'Tagged with',
      relationType: 'hasGlossaryTerm',
      edgeKind: 'assetBinding',
    },
  ],
};

describe('OntologyStudio utils', () => {
  it('computes scoped health without letting unrelated filters hide isolated terms', () => {
    const health = getOntologyHealthSummary(GRAPH, {
      ...FILTERS,
      glossaryIds: ['g1'],
      relationTypes: ['broader'],
      showIsolatedNodes: false,
    });

    expect(health.totalTermCount).toBe(4);
    expect(health.connectedTermCount).toBe(3);
    expect(health.connectedPercent).toBe(75);
    expect(health.isolatedTerms.map((term) => term.id)).toEqual(['d']);
  });

  it('flags every broader parent while retaining one deterministic tree depth', () => {
    const groups = buildOntologyTreeGroups(
      GRAPH,
      { ...FILTERS, glossaryIds: ['g1'] },
      GLOSSARIES,
      RELATION_TYPES
    );
    const child = groups[0].rows.find((row) => row.node.id === 'c');
    const detached = groups[0].rows.find((row) => row.node.id === 'd');

    expect(groups).toHaveLength(1);
    expect(groups[0].glossaryName).toBe('Finance');
    expect(child).toMatchObject({ depth: 1, parentCount: 2 });
    expect(detached).toMatchObject({ isIsolated: true, relationCount: 0 });
  });

  it('derives executable query suggestions from scoped ontology relations', () => {
    const suggestions = buildOntologyQuerySuggestions(
      GRAPH,
      ['g1'],
      RELATION_TYPES
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      label: 'Broader: Beta parent',
    });
    expect(suggestions[0].query).toContain(
      '<http://www.w3.org/2004/02/skos/core#broader>'
    );
    expect(suggestions[0].query).not.toContain('GRAPH');
    expect(suggestions[0].query).toContain('Finance.BetaParent');
    expect(suggestions[0].query).not.toContain('AntiMoneyLaundering');
  });
});
