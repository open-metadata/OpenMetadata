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
  AxiomType,
  ExpressionKind,
  Provenance,
} from '../../../../generated/api/data/createOntologyAxiom';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  createOntologyAxiom,
  validateOntologyAxiom,
} from '../../../../rest/ontologyAPI';
import OntologyAxiomEditor from './OntologyAxiomEditor';

jest.mock('../../../../rest/ontologyAPI', () => ({
  createOntologyAxiom: jest.fn(),
  validateOntologyAxiom: jest.fn(),
}));

const mockCreate = createOntologyAxiom as jest.MockedFunction<
  typeof createOntologyAxiom
>;
const mockValidate = validateOntologyAxiom as jest.MockedFunction<
  typeof validateOntologyAxiom
>;
const ONTOLOGY: Ontology = {
  description: 'Governed axiom',
  displayName: 'Governed glossary',
  fullyQualifiedName: 'GovernedGlossary',
  id: 'glossary-id',
  name: 'GovernedGlossary',
  iri: 'urn:governed',
  namespace: 'urn:governed:',
};

describe('OntologyAxiomEditor', () => {
  it('creates only after the live OWL profile guard accepts the typed axiom', async () => {
    mockValidate.mockResolvedValue({ valid: true, violations: [] });
    mockCreate.mockResolvedValue({
      axiomType: AxiomType.SubclassOf,
      description: ONTOLOGY.description ?? '',
      displayName: ONTOLOGY.displayName ?? ONTOLOGY.name,
      expressions: [
        {
          classIri: 'https://example.test/Class',
          kind: ExpressionKind.NamedClass,
        },
      ],
      fullyQualifiedName: 'GovernedGlossary.axiom-GovernedGlossary',
      ontology: { id: ONTOLOGY.id, type: 'ontology' },
      id: 'axiom-id',
      name: 'axiom-GovernedGlossary',
      provenance: Provenance.Manual,
      subjectIri: 'https://example.test/Subject',
    });
    render(<OntologyAxiomEditor canEdit ontology={ONTOLOGY} />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.display-name' }),
      { target: { value: 'Subclass' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.description' }),
      { target: { value: 'Customer is a party' } }
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.subject' }), {
      target: { value: 'https://example.test/Subject' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: /label\.concept-iri/ }),
      { target: { value: 'https://example.test/Class' } }
    );
    fireEvent.click(screen.getByTestId('ontology-axiom-validate'));

    await screen.findByText('label.validation-passed');
    fireEvent.click(screen.getByTestId('ontology-axiom-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        axiomType: AxiomType.SubclassOf,
        expressions: [
          {
            classIri: 'https://example.test/Class',
            kind: ExpressionKind.NamedClass,
          },
        ],
        ontology: ONTOLOGY.fullyQualifiedName,
        provenance: Provenance.Manual,
        subjectIri: 'https://example.test/Subject',
      })
    );
  });
});
