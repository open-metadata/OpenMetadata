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
import {
  EntityStatus,
  OntologyRelationshipSuggestion,
  OperationState,
  OperationType,
  Provenance,
} from '../../generated/api/data/ontologyRelationshipSuggestionList';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  Category,
  PaletteKey,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';
import {
  createOntologyChangeSet,
  suggestOntologyRelationships,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import OntologyAiRelationshipPanel from './OntologyAiRelationshipPanel';
import { OntologyGraphData } from './OntologyExplorer.interface';

jest.mock('../../rest/ontologyAPI', () => ({
  createOntologyChangeSet: jest.fn(),
  suggestOntologyRelationships: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockSuggest = suggestOntologyRelationships as jest.MockedFunction<
  typeof suggestOntologyRelationships
>;
const mockCreate = createOntologyChangeSet as jest.MockedFunction<
  typeof createOntologyChangeSet
>;

const glossary: Glossary = {
  description: 'Finance concepts',
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

const graphData: OntologyGraphData = {
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

const suggestion = (
  overrides: Partial<OntologyRelationshipSuggestion> = {}
): OntologyRelationshipSuggestion => ({
  confidence: 0.92,
  id: 'suggestion-id',
  operation: {
    id: 'operation-id',
    operationType: OperationType.AddRelationship,
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
        id: relationshipType.id,
        name: 'relatedTo',
        type: 'relationshipType',
      },
      status: EntityStatus.Draft,
      toTerm: { id: 'target-id', type: 'glossaryTerm' },
    },
    state: OperationState.Active,
    targetId: 'source-id',
  },
  rationale: 'Both concepts describe one customer account.',
  ...overrides,
});

const renderPanel = (data: OntologyGraphData | null = graphData) =>
  render(
    <OntologyAiRelationshipPanel
      canCreateDraft
      glossary={glossary}
      graphData={data}
      relationshipTypes={[relationshipType]}
    />
  );

const generate = () =>
  fireEvent.click(screen.getByTestId('generate-relationship-suggestions'));

describe('OntologyAiRelationshipPanel', () => {
  it('warns and disables generation when the scope is empty', () => {
    renderPanel(null);

    expect(
      screen.getByText('message.ontology-ai-relationship-scope-empty')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('generate-relationship-suggestions')
    ).toBeDisabled();
  });

  it('generates suggestions and labels them from the relationship payload', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [
        suggestion(),
        suggestion({
          id: 'bare-id',
          operation: { ...suggestion().operation, relationship: undefined },
        }),
      ],
    });
    renderPanel();

    expect(
      screen.queryByText('message.ontology-ai-relationship-scope-empty')
    ).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole('textbox', { name: /label.instructions/ }),
      { target: { value: ' focus on hierarchy ' } }
    );
    generate();

    const card = await screen.findByTestId(
      'relationship-suggestion-suggestion-id'
    );

    expect(card).toHaveTextContent('Account → target-id');
    expect(card).toHaveTextContent('relatedTo');
    expect(
      screen.getByTestId('relationship-suggestion-bare-id')
    ).toHaveTextContent('label.relationship');
    expect(
      screen.getByTestId('relationship-suggestion-bare-id')
    ).toHaveTextContent('label.relationship-type');
    expect(mockSuggest).toHaveBeenCalledWith({
      candidateTermIds: ['target-id'],
      glossary: 'Finance',
      instructions: 'focus on hierarchy',
      maxSuggestions: 10,
      relationshipTypeIds: [relationshipType.id],
      sourceTermIds: ['source-id'],
    });
  });

  it('shows the empty-result alert and omits blank instructions', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [],
    });
    renderPanel();

    generate();

    expect(
      await screen.findByText('message.ontology-ai-no-suggestions')
    ).toBeInTheDocument();
    expect(mockSuggest).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: undefined })
    );
  });

  it('toasts when suggestion generation fails', async () => {
    mockSuggest.mockRejectedValue(new Error('boom'));
    renderPanel();

    generate();

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );
  });

  it('persists an accepted suggestion as a Draft and removes its card', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [suggestion()],
    });
    mockCreate.mockResolvedValue({} as never);
    renderPanel();

    generate();
    await screen.findByTestId('relationship-suggestion-suggestion-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.add-to-draft' }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'label.ai-relationship-proposal',
          glossaries: ['Finance'],
          name: 'ai_suggestionid',
          operations: [
            expect.objectContaining({ operationType: 'ADD_RELATIONSHIP' }),
          ],
        })
      )
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.ontology-ai-draft-created'
    );
    expect(
      screen.queryByTestId('relationship-suggestion-suggestion-id')
    ).not.toBeInTheDocument();
  });

  it('keeps the card and toasts when accepting fails', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [suggestion()],
    });
    mockCreate.mockRejectedValue(new Error('boom'));
    renderPanel();

    generate();
    await screen.findByTestId('relationship-suggestion-suggestion-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.add-to-draft' }));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );

    expect(
      screen.getByTestId('relationship-suggestion-suggestion-id')
    ).toBeVisible();
  });

  it('dismisses a suggestion locally without calling the API', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [suggestion()],
    });
    renderPanel();

    generate();
    await screen.findByTestId('relationship-suggestion-suggestion-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.dismiss' }));

    expect(
      screen.queryByTestId('relationship-suggestion-suggestion-id')
    ).not.toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
