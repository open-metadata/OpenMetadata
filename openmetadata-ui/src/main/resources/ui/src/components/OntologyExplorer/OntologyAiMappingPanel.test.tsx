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
  ConceptMappingType,
  OntologyMappingSuggestion,
  OperationState,
  OperationType,
} from '../../generated/api/data/ontologyMappingSuggestionList';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  createOntologyChangeSet,
  suggestOntologyMappings,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import OntologyAiMappingPanel from './OntologyAiMappingPanel';
import { OntologyGraphData } from './OntologyExplorer.interface';

jest.mock('../../rest/ontologyAPI', () => ({
  createOntologyChangeSet: jest.fn(),
  suggestOntologyMappings: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockSuggest = suggestOntologyMappings as jest.MockedFunction<
  typeof suggestOntologyMappings
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

const graphData: OntologyGraphData = {
  edges: [],
  nodes: [
    {
      glossaryId: glossary.id,
      id: 'source-id',
      label: 'Account',
      type: 'glossaryTermIsolated',
    },
  ],
};

const suggestion = (
  overrides: Partial<OntologyMappingSuggestion> = {}
): OntologyMappingSuggestion => ({
  confidence: 0.85,
  id: 'mapping-id',
  operation: {
    id: 'operation-id',
    mapping: {
      conceptIri: 'https://example.com/Account',
      mappingType: ConceptMappingType.ExactMatch,
    },
    operationType: OperationType.UpsertMapping,
    state: OperationState.Active,
    targetId: 'source-id',
  },
  rationale: 'Equivalent definitions.',
  targetLabel: 'External account',
  ...overrides,
});

const renderPanel = (data: OntologyGraphData | null = graphData) =>
  render(
    <OntologyAiMappingPanel
      canCreateDraft
      glossary={glossary}
      graphData={data}
    />
  );

const typeStandards = (value: string) =>
  fireEvent.change(
    screen.getByRole('textbox', { name: /label.standard-plural/ }),
    { target: { value } }
  );

const generate = () =>
  fireEvent.click(screen.getByTestId('generate-mapping-suggestions'));

describe('OntologyAiMappingPanel', () => {
  it('warns and disables generation when the glossary has no terms in scope', () => {
    renderPanel(null);

    expect(
      screen.getByText('message.ontology-ai-mapping-scope-empty')
    ).toBeInTheDocument();
    expect(screen.getByTestId('generate-mapping-suggestions')).toBeDisabled();
  });

  it('keeps generation disabled until at least one standard is entered', () => {
    renderPanel();

    expect(screen.getByTestId('generate-mapping-suggestions')).toBeDisabled();

    typeStandards('FIBO');

    expect(screen.getByTestId('generate-mapping-suggestions')).toBeEnabled();
  });

  it('de-duplicates standards and passes trimmed instructions to the API', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [
        suggestion(),
        suggestion({
          id: 'orphan-id',
          operation: {
            ...suggestion().operation,
            mapping: undefined,
            targetId: 'unknown-id',
          },
          targetLabel: 'Orphan',
        }),
      ],
    });
    renderPanel();

    typeStandards(' FIBO , ISO,, FIBO ');
    fireEvent.change(
      screen.getByRole('textbox', { name: /label.instructions/ }),
      { target: { value: '  prefer exact matches  ' } }
    );
    generate();

    expect(
      await screen.findByTestId('mapping-suggestion-mapping-id')
    ).toHaveTextContent('Account → External account');
    expect(
      screen.getByTestId('mapping-suggestion-orphan-id')
    ).toHaveTextContent('label.concept → Orphan');
    expect(mockSuggest).toHaveBeenCalledWith({
      glossary: 'Finance',
      instructions: 'prefer exact matches',
      maxSuggestions: 10,
      sourceTermIds: ['source-id'],
      standards: ['FIBO', 'ISO'],
    });
  });

  it('shows the empty-result alert when the API returns no suggestions', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [],
    });
    renderPanel();

    typeStandards('FIBO');
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

    typeStandards('FIBO');
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

    typeStandards('FIBO');
    generate();
    await screen.findByTestId('mapping-suggestion-mapping-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.add-to-draft' }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'message.ontology-ai-proposal-draft-description',
          displayName: 'label.ai-mapping-proposal',
          glossaries: ['Finance'],
          name: 'ai_mappingid',
          operations: [
            expect.objectContaining({
              operationType: 'UPSERT_MAPPING',
              targetId: 'source-id',
            }),
          ],
        })
      )
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.ontology-ai-draft-created'
    );
    expect(
      screen.queryByTestId('mapping-suggestion-mapping-id')
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

    typeStandards('FIBO');
    generate();
    await screen.findByTestId('mapping-suggestion-mapping-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.add-to-draft' }));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );

    expect(screen.getByTestId('mapping-suggestion-mapping-id')).toBeVisible();
  });

  it('dismisses a suggestion locally without calling the API', async () => {
    mockSuggest.mockResolvedValue({
      generatedAt: 1,
      modelId: 'model',
      suggestions: [suggestion()],
    });
    renderPanel();

    typeStandards('FIBO');
    generate();
    await screen.findByTestId('mapping-suggestion-mapping-id');
    fireEvent.click(screen.getByRole('button', { name: 'label.dismiss' }));

    expect(
      screen.queryByTestId('mapping-suggestion-mapping-id')
    ).not.toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
