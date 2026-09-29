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

import {
  ConceptMappingType,
  OperationState as MappingOperationState,
  OperationType as MappingOperationType,
} from '../../generated/api/data/ontologyMappingSuggestionList';
import {
  EntityStatus,
  OperationState as RelationshipOperationState,
  OperationType as RelationshipOperationType,
  Provenance,
} from '../../generated/api/data/ontologyRelationshipSuggestionList';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  Category,
  PaletteKey,
} from '../../generated/entity/data/relationshipType';
import {
  buildMappingSourceTermIds,
  buildOntologyAiScope,
  mappingDraftOperation,
  proposalChangeSet,
  relationshipDraftOperation,
} from './OntologyAiAssistant.utils';

const glossary: Glossary = {
  description: 'Finance concepts',
  displayName: 'Finance',
  fullyQualifiedName: 'Finance',
  id: 'glossary-id',
  name: 'Finance',
};

const graphData = {
  edges: [
    {
      from: 'connected-a',
      label: 'related',
      relationType: 'relatedTo',
      to: 'connected-b',
    },
  ],
  nodes: [
    {
      glossaryId: glossary.id,
      id: 'isolated',
      label: 'Isolated',
      type: 'glossaryTermIsolated',
    },
    {
      glossaryId: glossary.id,
      id: 'connected-a',
      label: 'Connected A',
      type: 'glossaryTerm',
    },
    {
      glossaryId: glossary.id,
      id: 'connected-b',
      label: 'Connected B',
      type: 'glossaryTerm',
    },
  ],
};

describe('OntologyAiAssistant utils', () => {
  it('prioritizes isolated concepts while retaining relationship candidates', () => {
    const scope = buildOntologyAiScope(graphData, glossary.id, [
      {
        category: Category.Custom,
        characteristics: [],
        crossGlossaryAllowed: false,
        description: 'Related concepts',
        displayName: 'Related to',
        fullyQualifiedName: 'relatedTo',
        id: 'relationship-type-id',
        name: 'relatedTo',
        paletteKey: PaletteKey.Blue,
        rdfPredicate: 'https://example.com/relatedTo',
        systemDefined: false,
      },
    ]);

    expect(scope).toEqual({
      candidateTermIds: ['connected-a', 'connected-b'],
      relationshipTypeIds: ['relationship-type-id'],
      sourceTermIds: ['isolated'],
    });
    expect(buildMappingSourceTermIds(graphData, glossary.id)).toEqual([
      'isolated',
      'connected-a',
      'connected-b',
    ]);
  });

  it('converts validated relationship proposals to the canonical draft schema', () => {
    const operation = relationshipDraftOperation({
      confidence: 0.9,
      id: 'suggestion-id',
      operation: {
        id: 'operation-id',
        operationType: RelationshipOperationType.AddRelationship,
        relationship: {
          createdAt: 1,
          createdBy: 'ask-collate',
          fromTerm: { id: 'from-id', type: 'glossaryTerm' },
          id: 'relationship-id',
          provenance: Provenance.AISuggested,
          relationshipType: { id: 'type-id', type: 'relationshipType' },
          status: EntityStatus.Draft,
          toTerm: { id: 'to-id', type: 'glossaryTerm' },
        },
        state: RelationshipOperationState.Active,
      },
      rationale: 'The concepts are semantically related.',
    });

    const request = proposalChangeSet(
      glossary,
      'suggestion-id',
      'AI relationship',
      'Review this proposal',
      operation
    );

    expect(request.operations?.[0]).toMatchObject({
      operationType: 'ADD_RELATIONSHIP',
      relationship: { provenance: 'AiSuggested', status: 'Draft' },
    });
    expect(request.glossaries).toEqual(['Finance']);
  });

  it('converts mapping enum values without weakening the draft type', () => {
    const operation = mappingDraftOperation({
      confidence: 0.8,
      id: 'mapping-id',
      operation: {
        id: 'operation-id',
        mapping: {
          conceptIri: 'https://example.com/Concept',
          mappingType: ConceptMappingType.ExactMatch,
        },
        operationType: MappingOperationType.UpsertMapping,
        state: MappingOperationState.Active,
      },
      rationale: 'The definitions are equivalent.',
      targetLabel: 'External concept',
    });

    expect(operation).toMatchObject({
      mapping: { mappingType: 'EXACT_MATCH' },
      operationType: 'UPSERT_MAPPING',
    });
  });
});
