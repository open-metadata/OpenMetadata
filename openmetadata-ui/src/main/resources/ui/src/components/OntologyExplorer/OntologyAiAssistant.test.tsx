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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DraftState } from '../../generated/api/data/ontologyDomainDraftResult';
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
import { OntologyChangeSetState } from '../../generated/entity/data/ontologyChangeSet';
import {
  Category,
  PaletteKey,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';
import {
  createOntologyChangeSet,
  generateOntologyDomainDraft,
  generateOntologySparql,
  suggestOntologyMappings,
  suggestOntologyRelationships,
} from '../../rest/ontologyAPI';
import OntologyAiAssistant from './OntologyAiAssistant';

jest.mock('../../rest/ontologyAPI');

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockCreateOntologyChangeSet =
  createOntologyChangeSet as jest.MockedFunction<
    typeof createOntologyChangeSet
  >;
const mockGenerateOntologyDomainDraft =
  generateOntologyDomainDraft as jest.MockedFunction<
    typeof generateOntologyDomainDraft
  >;
const mockGenerateOntologySparql =
  generateOntologySparql as jest.MockedFunction<typeof generateOntologySparql>;
const mockSuggestOntologyMappings =
  suggestOntologyMappings as jest.MockedFunction<
    typeof suggestOntologyMappings
  >;
const mockSuggestOntologyRelationships =
  suggestOntologyRelationships as jest.MockedFunction<
    typeof suggestOntologyRelationships
  >;

const glossary: Glossary = {
  description: 'Finance concepts',
  displayName: 'Finance',
  fullyQualifiedName: 'Finance',
  id: 'glossary-id',
  name: 'Finance',
};

const relationshipType: RelationshipType = {
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
};

const graphData = {
  edges: [],
  nodes: [
    {
      glossaryId: glossary.id,
      id: 'source-id',
      label: 'Account',
      type: 'glossaryTermIsolated',
    },
    {
      glossaryId: glossary.id,
      id: 'target-id',
      label: 'Customer',
      type: 'glossaryTermIsolated',
    },
  ],
};

describe('OntologyAiAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateOntologyChangeSet.mockResolvedValue({
      description: 'Draft',
      displayName: 'Draft',
      fullyQualifiedName: 'Draft',
      glossaries: [],
      id: 'draft-id',
      name: 'Draft',
      operations: [],
      state: OntologyChangeSetState.Draft,
      undoCursor: 0,
    });
  });

  it('persists an accepted relationship proposal as a Draft', async () => {
    mockSuggestOntologyRelationships.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [
        {
          confidence: 0.92,
          id: 'suggestion-id',
          operation: {
            id: 'operation-id',
            operationType: RelationshipOperationType.AddRelationship,
            relationship: {
              createdAt: 1,
              createdBy: 'ask-collate',
              fromTerm: {
                displayName: 'Account',
                id: 'source-id',
                type: 'glossaryTerm',
              },
              id: 'relation-id',
              provenance: Provenance.AISuggested,
              relationshipType: {
                displayName: 'Related to',
                id: relationshipType.id,
                type: 'relationshipType',
              },
              status: EntityStatus.Draft,
              toTerm: {
                displayName: 'Customer',
                id: 'target-id',
                type: 'glossaryTerm',
              },
            },
            state: RelationshipOperationState.Active,
            targetId: 'source-id',
          },
          rationale: 'Both concepts describe one customer account.',
        },
      ],
    });

    render(
      <OntologyAiAssistant
        canCreateDraft
        glossary={glossary}
        graphData={graphData}
        relationshipTypes={[relationshipType]}
        onOpenQuery={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('generate-relationship-suggestions'));
    await screen.findByTestId('relationship-suggestion-suggestion-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.add-to-draft' }));

    await waitFor(() => expect(mockCreateOntologyChangeSet).toHaveBeenCalled());

    expect(mockCreateOntologyChangeSet).toHaveBeenCalledWith(
      expect.objectContaining({
        glossaries: ['Finance'],
        operations: [
          expect.objectContaining({ operationType: 'ADD_RELATIONSHIP' }),
        ],
        state: 'DRAFT',
      })
    );
  });

  it('creates standards mapping proposals and keeps dismissal local', async () => {
    mockSuggestOntologyMappings.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [
        {
          confidence: 0.85,
          id: 'mapping-id',
          operation: {
            id: 'mapping-operation-id',
            mapping: {
              conceptIri: 'https://example.com/Account',
              mappingType: ConceptMappingType.ExactMatch,
            },
            operationType: MappingOperationType.UpsertMapping,
            state: MappingOperationState.Active,
            targetId: 'source-id',
          },
          rationale: 'The concepts have equivalent definitions.',
          targetLabel: 'External account',
        },
      ],
    });

    render(
      <OntologyAiAssistant
        canCreateDraft
        glossary={glossary}
        graphData={graphData}
        relationshipTypes={[relationshipType]}
        onOpenQuery={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'label.mapping-plural' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: /label.standard-plural/ }),
      { target: { value: 'FIBO' } }
    );
    fireEvent.click(screen.getByTestId('generate-mapping-suggestions'));
    await screen.findByTestId('mapping-suggestion-mapping-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.dismiss' }));

    expect(
      screen.queryByTestId('mapping-suggestion-mapping-id')
    ).not.toBeInTheDocument();
    expect(mockCreateOntologyChangeSet).not.toHaveBeenCalled();
  });

  it('always exposes generated SPARQL before handing it to the console', async () => {
    const onOpenQuery = jest.fn();
    mockGenerateOntologySparql.mockResolvedValue({
      explanation: 'Find every concept in the selected ontology.',
      generatedAt: 1,
      modelId: 'model',
      query: 'SELECT ?concept WHERE { ?concept a <urn:Concept> }',
    });

    render(
      <OntologyAiAssistant
        canCreateDraft
        glossary={glossary}
        graphData={graphData}
        relationshipTypes={[relationshipType]}
        onOpenQuery={onOpenQuery}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'label.query' }));
    fireEvent.change(screen.getByRole('textbox', { name: /label.question/ }), {
      target: { value: 'Show every concept' },
    });
    fireEvent.click(screen.getByTestId('generate-ontology-sparql'));

    expect(
      await screen.findByTestId('ontology-ai-query-text')
    ).toHaveTextContent('SELECT ?concept WHERE { ?concept a <urn:Concept> }');

    fireEvent.click(
      screen.getByRole('button', { name: 'label.open-in-query-console' })
    );

    expect(onOpenQuery).toHaveBeenCalledWith(
      'SELECT ?concept WHERE { ?concept a <urn:Concept> }'
    );
  });

  it('requires explicit persistence after generating a domain Draft', async () => {
    mockGenerateOntologyDomainDraft.mockResolvedValue({
      draft: {
        description: 'Generated domain',
        displayName: 'Retail draft',
        glossaries: ['Finance'],
        name: 'retail_draft',
        operations: [],
        state: DraftState.Draft,
        undoCursor: 0,
      },
      generatedAt: 1,
      modelId: 'model',
    });

    render(
      <OntologyAiAssistant
        canCreateDraft
        glossary={glossary}
        graphData={graphData}
        relationshipTypes={[relationshipType]}
        onOpenQuery={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'label.domain-draft' }));
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'retail_draft' } });
    fireEvent.change(inputs[1], { target: { value: 'Retail draft' } });
    fireEvent.change(inputs[2], {
      target: { value: 'Review retail concepts' },
    });
    fireEvent.change(inputs[3], { target: { value: 'Model retail banking' } });
    fireEvent.click(screen.getByTestId('generate-domain-draft'));

    await screen.findByTestId('ontology-ai-domain-preview');

    expect(mockCreateOntologyChangeSet).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('create-generated-domain-draft'));

    await waitFor(() =>
      expect(mockCreateOntologyChangeSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'retail_draft' })
      )
    );
  });

  it('renders no workflows until one glossary is explicitly selected', () => {
    render(
      <OntologyAiAssistant
        canCreateDraft
        graphData={graphData}
        relationshipTypes={[relationshipType]}
        onOpenQuery={jest.fn()}
      />
    );

    expect(
      screen.getByText('message.ontology-ai-select-glossary')
    ).toBeVisible();
    expect(mockSuggestOntologyRelationships).not.toHaveBeenCalled();
    expect(mockSuggestOntologyMappings).not.toHaveBeenCalled();
    expect(mockGenerateOntologySparql).not.toHaveBeenCalled();
    expect(mockGenerateOntologyDomainDraft).not.toHaveBeenCalled();
  });

  it('keeps Draft-only authoring controls hidden for a read-only user', () => {
    render(
      <OntologyAiAssistant
        canCreateDraft={false}
        glossary={glossary}
        graphData={graphData}
        relationshipTypes={[relationshipType]}
        onOpenQuery={jest.fn()}
      />
    );

    expect(
      screen.queryByRole('tab', { name: 'label.domain-draft' })
    ).not.toBeInTheDocument();
  });
});
