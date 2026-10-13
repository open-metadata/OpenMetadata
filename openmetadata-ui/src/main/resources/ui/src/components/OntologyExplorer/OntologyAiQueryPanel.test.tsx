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
import { Glossary } from '../../generated/entity/data/glossary';
import { generateOntologySparql } from '../../rest/ontologyAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import OntologyAiQueryPanel from './OntologyAiQueryPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  generateOntologySparql: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGenerate = generateOntologySparql as jest.MockedFunction<
  typeof generateOntologySparql
>;

const glossary: Glossary = {
  description: 'Finance concepts',
  fullyQualifiedName: 'Finance',
  id: 'glossary-id',
  name: 'Finance',
};

const query = 'SELECT ?concept WHERE { ?concept a <urn:Concept> }';

const askQuestion = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: /label.question/ }), {
    target: { value },
  });

describe('OntologyAiQueryPanel', () => {
  const onOpenQuery = jest.fn();

  beforeEach(() => {
    render(
      <OntologyAiQueryPanel glossary={glossary} onOpenQuery={onOpenQuery} />
    );
  });

  it('disables generation for a blank question', () => {
    expect(screen.getByTestId('generate-ontology-sparql')).toBeDisabled();

    askQuestion('   ');

    expect(screen.getByTestId('generate-ontology-sparql')).toBeDisabled();

    askQuestion('Show every concept');

    expect(screen.getByTestId('generate-ontology-sparql')).toBeEnabled();
  });

  it('shows the generated SPARQL and hands it to the console on request', async () => {
    mockGenerate.mockResolvedValue({
      explanation: 'Find every concept.',
      generatedAt: 1,
      modelId: 'model',
      query,
    });

    askQuestion('  Show every concept  ');
    fireEvent.click(screen.getByTestId('generate-ontology-sparql'));

    expect(
      await screen.findByTestId('ontology-ai-query-text')
    ).toHaveTextContent(query);
    expect(screen.getByText('Find every concept.')).toBeInTheDocument();
    expect(mockGenerate).toHaveBeenCalledWith({
      glossaries: ['Finance'],
      question: 'Show every concept',
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'label.open-in-query-console' })
    );

    expect(onOpenQuery).toHaveBeenCalledWith(query);
  });

  it('toasts and renders no result when generation fails', async () => {
    mockGenerate.mockRejectedValue(new Error('boom'));

    askQuestion('Show every concept');
    fireEvent.click(screen.getByTestId('generate-ontology-sparql'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );

    expect(
      screen.queryByTestId('ontology-ai-generated-query')
    ).not.toBeInTheDocument();
  });
});
