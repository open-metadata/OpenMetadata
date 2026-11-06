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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Layer, Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useEnUsTranslations } from '../../../../test/unit/enUsTranslation';
import { renderWithQueryClient as render } from '../../../../test/unit/test-utils';
import OntologyAllOntologiesConceptDrawer from './OntologyAllOntologiesConceptDrawer';

const ontologyOf = (id: string, name: string): Ontology => ({
  id,
  name,
  fullyQualifiedName: name,
  iri: `urn:${name}`,
  namespace: `https://example.org/${name}#`,
  layer: Layer.L2,
});
const finance = ontologyOf('o-finance', 'Finance');
const risk = ontologyOf('o-risk', 'Risk');
const conceptsOf = (ontology: Ontology, names: string[]) =>
  names.map((name) => ({
    id: `${ontology.id}-${name}`,
    name,
    displayName: name,
    fullyQualifiedName: `${ontology.name}.${name}`,
    iri: `${ontology.namespace}${name}`,
    conceptType: OntologyConceptType.OwlClass,
    ontology: { id: ontology.id, type: 'ontology' },
  }));
const models: Record<string, unknown> = {
  [finance.id]: {
    ontology: finance,
    concepts: conceptsOf(finance, ['Payment']),
    properties: [],
    axioms: [],
  },
  [risk.id]: {
    ontology: risk,
    concepts: conceptsOf(risk, ['Exposure']),
    properties: [],
    axioms: [],
  },
};

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioModel',
  () => ({
    useOntologyStudioModel: (ontology: Ontology) => ({
      model: models[ontology.id],
      refetch: jest.fn(),
    }),
  })
);
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({ canEditAll: true }),
  })
);
jest.mock('../../../../utils/PermissionDerivation', () => ({
  getDerivedPermissionFlags: () => ({ canCreate: true }),
}));
jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn().mockResolvedValue({ data: { data: [], paging: {} } }),
  post: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('Add concept from All ontologies', () => {
  useEnUsTranslations();

  beforeEach(() => {
    localStorage.setItem('ontology-studio-last-concept-ontology', finance.id);
    useApplicationStore.setState({
      currentUser: { id: 'u', name: 'editor', email: 'editor@example.org' },
    });
  });

  it('keeps the typed name and description and clears the parent when the ontology changes', async () => {
    render(
      <OntologyAllOntologiesConceptDrawer
        ontologies={[finance, risk]}
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />
    );
    type('new-class-label', 'Remittance');
    type('new-class-description', 'Money sent abroad');
    fireEvent.click(screen.getByTestId('new-class-advanced-toggle'));
    const parent = screen.getByRole('combobox', { name: 'Subclass of' });
    fireEvent.focus(parent);
    fireEvent.change(parent, { target: { value: 'Payment' } });
    fireEvent.keyDown(parent, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Payment' }));

    expect(screen.getByTestId('new-class-advanced')).toHaveTextContent(
      'Payment'
    );

    fireEvent.change(
      within(screen.getByTestId('new-class-ontology')).getByRole('combobox', {
        hidden: true,
      }),
      { target: { value: risk.id } }
    );

    await waitFor(() =>
      expect(screen.getByTestId('new-class-iri')).toHaveTextContent(
        'https://example.org/Risk#Remittance'
      )
    );

    expect(screen.getByTestId('new-class-label')).toHaveValue('Remittance');
    expect(screen.getByTestId('new-class-description')).toHaveValue(
      'Money sent abroad'
    );
    expect(screen.getByTestId('new-class-iri')).toHaveTextContent(
      'https://example.org/Risk#Remittance'
    );
    expect(screen.getByTestId('new-class-advanced')).not.toHaveTextContent(
      'Payment'
    );
  });
});
