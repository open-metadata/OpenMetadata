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
import { fireEvent, screen } from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  AxiomType,
  OntologyAxiom,
  Provenance,
} from '../../../../generated/entity/data/ontologyAxiom';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import { getOntologyWorkingValidation } from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyAxiomWorkspace from './OntologyAxiomWorkspace';

const concept = (id: string): OntologyConcept =>
  ({
    id,
    name: id,
    displayName: `${id} Record`,
    iri: `https://x.org/fhir/${id}`,
    conceptType: OntologyConceptType.SkosConcept,
  } as OntologyConcept);

const axiom = (id: string, provenance: Provenance): OntologyAxiom =>
  ({
    id,
    name: id,
    axiomType: AxiomType.ObjectPropertyAssertion,
    subjectIri: 'https://x.org/fhir/Patient',
    propertyIri: 'http://www.w3.org/2004/02/skos/core#broader',
    targetIri: 'https://x.org/fhir/Clinical',
    expressions: [],
    provenance,
  } as unknown as OntologyAxiom);

const mockModel = {
  concepts: [concept('Patient'), concept('Clinical')],
  properties: [],
  axioms: [
    axiom('imported', Provenance.Imported),
    axiom('manual', Provenance.Manual),
  ],
};

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioModel',
  () => ({
    useOntologyStudioModel: () => ({
      model: mockModel,
      relations: [],
      isError: false,
      refetch: jest.fn(),
    }),
  })
);
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { ontologyAxiom: { Create: true } },
  }),
}));
jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntologyWorkingValidation: jest.fn(),
  restoreOntologyDefinition: jest.fn(),
}));
jest.mock('../OntologyAxiomEditor/OntologyAxiomEditor', () => () => (
  <div data-testid="axiom-editor" />
));

const ontology = { id: 'o', name: 'fhir' } as Ontology;

describe('OntologyAxiomWorkspace', () => {
  beforeEach(() => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      violations: [],
    });
  });

  it('reads each constraint as a sentence with names, not IRIs', async () => {
    renderWithQueryClient(<OntologyAxiomWorkspace ontology={ontology} />);

    const first = await screen.findByRole('row', { name: /imported/ });

    expect(first).toHaveTextContent('Patient Record');
    expect(first).toHaveTextContent('broader');
    expect(first).not.toHaveTextContent('https://');
    expect(screen.getByTestId('ontology-definition-summary')).toHaveTextContent(
      'label.n-of-m'
    );
  });

  it('opens the constraint subject on the graph', async () => {
    const onOpenConcept = jest.fn();
    renderWithQueryClient(
      <OntologyAxiomWorkspace
        ontology={ontology}
        onOpenConcept={onOpenConcept}
      />
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'label.show-on-graph' }))[0]
    );

    expect(onOpenConcept).toHaveBeenCalledWith('Patient');
  });

  it('shares the Overview validation run and reports a clean draft', async () => {
    renderWithQueryClient(<OntologyAxiomWorkspace ontology={ontology} />);

    expect(
      await screen.findByText('message.ontology-validate-all-clean')
    ).toBeInTheDocument();
    expect(getOntologyWorkingValidation).toHaveBeenCalledTimes(1);
  });
});
