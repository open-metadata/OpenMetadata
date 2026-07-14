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
import { OntologyNode } from '../OntologyExplorer.interface';
import {
  computeGraphSearchHighlight,
  ontologyEdgeKey,
} from './graphSearchHighlight';

const NODES: OntologyNode[] = [
  { id: 'alpha-id', label: 'Alpha', type: 'glossaryTerm' },
  { id: 'beta-id', label: 'Beta', type: 'glossaryTerm' },
];
const EDGES = [{ from: 'alpha-id', to: 'beta-id', relationType: 'requires' }];
const RELATION_TYPES: GlossaryTermRelationType[] = [
  {
    name: 'requires',
    displayName: 'Requires',
    category: 'associative',
  },
];

describe('computeGraphSearchHighlight', () => {
  it('highlights only an entity match while retaining its incident edge', () => {
    const result = computeGraphSearchHighlight(
      NODES,
      EDGES,
      'Alpha',
      [],
      RELATION_TYPES
    );

    expect(result?.highlightedNodeIds).toEqual(['alpha-id']);
    expect(result?.highlightedEdgeKeys).toEqual([ontologyEdgeKey(EDGES[0])]);
  });

  it('highlights both endpoints when the relation type matches', () => {
    const result = computeGraphSearchHighlight(
      NODES,
      EDGES,
      'requires',
      [],
      RELATION_TYPES
    );

    expect(result?.highlightedNodeIds).toEqual(['alpha-id', 'beta-id']);
  });

  it('matches an id or abbreviation as well as the display label', () => {
    const result = computeGraphSearchHighlight(
      NODES,
      EDGES,
      'beta-id',
      [],
      RELATION_TYPES
    );

    expect(result?.highlightedNodeIds).toEqual(['beta-id']);
  });
});
