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

import { GraphFilters, OntologyGraphData } from '../OntologyExplorer.interface';
import {
  getOntologyHealthSummary,
  resolveOntologyTermLabel,
} from './ontologyHealth';

const FILTERS: GraphFilters = {
  glossaryIds: [],
  relationTypes: [],
  searchQuery: '',
  showCrossGlossaryOnly: false,
  showIsolatedNodes: true,
  viewMode: 'overview',
};

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

describe('ontologyHealth', () => {
  it('resolves a human label without allowing an entity UUID to win', () => {
    const id = '002e5485-0c59-45cc-912e-15fbc7e350bf';

    expect(
      resolveOntologyTermLabel({
        displayName: 'Customer Account',
        fullyQualifiedName: 'Finance.customer_account',
        id,
        label: id,
        name: 'customer_account',
      })
    ).toBe('Customer Account');
    expect(
      resolveOntologyTermLabel({
        displayName: '  ',
        fullyQualifiedName: 'Finance.customer_account',
        id,
        label: id,
        name: 'customer_account',
      })
    ).toBe('customer_account');
    expect(
      resolveOntologyTermLabel({
        fullyQualifiedName: 'Finance."Customer.Account"',
        id,
        label: id,
        name: id,
      })
    ).toBe('Customer.Account');
  });

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
});
