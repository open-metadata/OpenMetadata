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
import { previewOntologyIri } from '../../rest/ontologyAPI';
import OntologyIriPreviewPanel from './OntologyIriPreviewPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  previewOntologyIri: jest.fn(),
}));

const mockPreview = previewOntologyIri as jest.MockedFunction<
  typeof previewOntologyIri
>;

const GLOSSARY: Glossary = {
  description: 'Governed concepts',
  id: 'glossary-id',
  name: 'GovernedGlossary',
};

describe('OntologyIriPreviewPanel', () => {
  it('renders the exact typed IRI returned by the minting policy', async () => {
    mockPreview.mockResolvedValue({
      baseIri: 'https://example.test/ontology/',
      candidateId: 'candidate-id',
      glossaryId: GLOSSARY.id,
      iri: 'https://example.test/ontology/customer-account',
      pattern: '{term}',
      termSegment: 'customer-account',
    });
    render(<OntologyIriPreviewPanel glossary={GLOSSARY} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: ' Customer Account ' },
    });
    fireEvent.click(screen.getByTestId('ontology-iri-preview-submit'));

    await waitFor(() =>
      expect(mockPreview).toHaveBeenCalledWith({
        glossaryId: GLOSSARY.id,
        termName: 'Customer Account',
      })
    );

    expect(
      screen.getByText('https://example.test/ontology/customer-account')
    ).toBeInTheDocument();
  });
});
