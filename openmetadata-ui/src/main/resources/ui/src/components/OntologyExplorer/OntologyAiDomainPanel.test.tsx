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
  DraftState,
  OntologyDomainDraftResult,
} from '../../generated/api/data/ontologyDomainDraftResult';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  createOntologyChangeSet,
  generateOntologyDomainDraft,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import OntologyAiDomainPanel from './OntologyAiDomainPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  createOntologyChangeSet: jest.fn(),
  generateOntologyDomainDraft: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGenerate = generateOntologyDomainDraft as jest.MockedFunction<
  typeof generateOntologyDomainDraft
>;
const mockCreate = createOntologyChangeSet as jest.MockedFunction<
  typeof createOntologyChangeSet
>;

const glossary: Glossary = {
  description: 'Finance concepts',
  id: 'glossary-id',
  name: 'Finance',
};

const draftResult: OntologyDomainDraftResult = {
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
};

const fillForm = () => {
  const inputs = screen.getAllByRole('textbox');
  fireEvent.change(inputs[0], { target: { value: ' retail_draft ' } });
  fireEvent.change(inputs[1], { target: { value: 'Retail draft' } });
  fireEvent.change(inputs[2], { target: { value: 'Review retail concepts' } });
  fireEvent.change(inputs[3], { target: { value: 'Model retail banking' } });
};

const generate = () =>
  fireEvent.click(screen.getByTestId('generate-domain-draft'));

describe('OntologyAiDomainPanel', () => {
  beforeEach(() => {
    render(<OntologyAiDomainPanel glossary={glossary} />);
  });

  it('keeps generation disabled until every field has a value', () => {
    expect(screen.getByTestId('generate-domain-draft')).toBeDisabled();

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'only one' },
    });

    expect(screen.getByTestId('generate-domain-draft')).toBeDisabled();

    fillForm();

    expect(screen.getByTestId('generate-domain-draft')).toBeEnabled();
  });

  it('generates a preview from trimmed values using the glossary name as fallback FQN', async () => {
    mockGenerate.mockResolvedValue(draftResult);

    fillForm();
    generate();

    const preview = await screen.findByTestId('ontology-ai-domain-preview');

    expect(preview).toHaveTextContent('Retail draft');
    expect(preview).toHaveTextContent('Generated domain');
    expect(mockGenerate).toHaveBeenCalledWith({
      changeSetName: 'retail_draft',
      description: 'Review retail concepts',
      displayName: 'Retail draft',
      domainDescription: 'Model retail banking',
      glossary: 'Finance',
      maxConcepts: 25,
    });
  });

  it('renders a preview whose draft has no operations', async () => {
    mockGenerate.mockResolvedValue({
      ...draftResult,
      draft: { ...draftResult.draft, operations: undefined },
    });

    fillForm();
    generate();

    expect(
      await screen.findByTestId('ontology-ai-domain-preview')
    ).toBeInTheDocument();
  });

  it('toasts when generation fails', async () => {
    mockGenerate.mockRejectedValue(new Error('boom'));

    fillForm();
    generate();

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );

    expect(
      screen.queryByTestId('ontology-ai-domain-preview')
    ).not.toBeInTheDocument();
  });

  it('discards the preview when a field changes', async () => {
    mockGenerate.mockResolvedValue(draftResult);

    fillForm();
    generate();
    await screen.findByTestId('ontology-ai-domain-preview');

    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'Changed' },
    });

    expect(
      screen.queryByTestId('ontology-ai-domain-preview')
    ).not.toBeInTheDocument();
  });

  it('persists the generated draft only on explicit confirmation', async () => {
    mockGenerate.mockResolvedValue(draftResult);
    mockCreate.mockResolvedValue({} as never);

    fillForm();
    generate();
    await screen.findByTestId('ontology-ai-domain-preview');

    expect(mockCreate).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('create-generated-domain-draft')
    ).toHaveTextContent('label.create-draft');

    fireEvent.click(screen.getByTestId('create-generated-domain-draft'));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(draftResult.draft)
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.ontology-ai-draft-created'
    );
    expect(screen.getByTestId('create-generated-domain-draft')).toBeDisabled();
    expect(
      screen.getByTestId('create-generated-domain-draft')
    ).toHaveTextContent('label.draft-created');
  });

  it('toasts and keeps the draft creatable when persistence fails', async () => {
    mockGenerate.mockResolvedValue(draftResult);
    mockCreate.mockRejectedValue(new Error('boom'));

    fillForm();
    generate();
    await screen.findByTestId('ontology-ai-domain-preview');
    fireEvent.click(screen.getByTestId('create-generated-domain-draft'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );

    expect(screen.getByTestId('create-generated-domain-draft')).toBeEnabled();
  });
});
