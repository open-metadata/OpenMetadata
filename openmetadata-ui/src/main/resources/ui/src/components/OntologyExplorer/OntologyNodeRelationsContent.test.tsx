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
  GlossaryTerm,
} from '../../generated/entity/data/glossaryTerm';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import {
  getGlossaryTermsById,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import { OntologyNodeRelationsContent } from './OntologyNodeRelationsContent';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTermsById: jest.fn(),
  patchGlossaryTerm: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const CHILD_ID = '11111111-1111-1111-1111-111111111111';
const TERM: GlossaryTerm = {
  id: CHILD_ID,
  name: 'Child',
  description: '',
  glossary: { id: 'glossary-id', type: 'glossary' },
  conceptMappings: [
    {
      conceptIri: 'https://example.com/existing',
      mappingType: ConceptMappingType.BroadMatch,
    },
  ],
};

const mockGetTerm = getGlossaryTermsById as jest.MockedFunction<
  typeof getGlossaryTermsById
>;
const mockPatchTerm = patchGlossaryTerm as jest.MockedFunction<
  typeof patchGlossaryTerm
>;

describe('OntologyNodeRelationsContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTerm.mockResolvedValue(TERM);
    mockPatchTerm.mockResolvedValue({
      ...TERM,
      conceptMappings: [
        ...(TERM.conceptMappings ?? []),
        {
          conceptIri: 'https://example.com/new',
          mappingType: ConceptMappingType.ExactMatch,
        },
      ],
    });
  });

  it('flags polyhierarchy and persists a typed external mapping', async () => {
    render(
      <OntologyNodeRelationsContent
        isEditMode
        edges={[
          {
            from: 'parent-a',
            to: CHILD_ID,
            label: 'Parent of',
            relationType: 'parentOf',
          },
          {
            from: CHILD_ID,
            to: 'parent-b',
            label: 'Broader',
            relationType: 'broader',
          },
        ]}
        node={{ id: CHILD_ID, label: 'Child', type: 'glossaryTerm' }}
        nodes={[
          { id: CHILD_ID, label: 'Child', type: 'glossaryTerm' },
          { id: 'parent-a', label: 'Parent A', type: 'glossaryTerm' },
          { id: 'parent-b', label: 'Parent B', type: 'glossaryTerm' },
        ]}
        relationTypes={[
          createRelationshipTypeMock({
            name: 'broader',
            displayName: 'Broader',
            rdfPredicate: 'http://www.w3.org/2004/02/skos/core#broader',
          }),
        ]}
      />
    );

    expect(screen.getByTestId('ontology-polyhierarchy')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('https://example.com/existing')
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-concept-mapping'));
    const conceptIriInput = screen
      .getByTestId('concept-mapping-iri')
      .querySelector('input');

    expect(conceptIriInput).not.toBeNull();

    fireEvent.change(conceptIriInput!, {
      target: { value: 'https://example.com/new' },
    });
    fireEvent.click(screen.getByTestId('save-concept-mapping'));

    await waitFor(() => {
      expect(mockPatchTerm).toHaveBeenCalledWith(CHILD_ID, [
        {
          op: 'add',
          path: '/conceptMappings/-',
          value: {
            conceptIri: 'https://example.com/new',
            mappingType: ConceptMappingType.ExactMatch,
          },
        },
      ]);
    });
  });
});
