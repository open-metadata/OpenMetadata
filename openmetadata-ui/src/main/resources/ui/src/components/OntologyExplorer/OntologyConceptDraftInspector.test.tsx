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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { DataType } from '../../generated/type/ontologyAttribute';
import { addGlossaryTerm } from '../../rest/glossaryAPI';
import OntologyConceptDraftInspector from './OntologyConceptDraftInspector';
import { OntologyNode } from './OntologyExplorer.interface';

jest.mock('../../rest/glossaryAPI', () => ({
  addGlossaryTerm: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const GLOSSARY: Glossary = {
  description: 'Customer lifecycle ontology',
  fullyQualifiedName: 'CustomerLifecycle',
  id: 'glossary-id',
  name: 'CustomerLifecycle',
};
const DRAFT_NODE: OntologyNode = {
  id: 'ontology-concept-draft-id',
  isDraft: true,
  label: 'New Concept',
  type: 'glossaryTermIsolated',
};
const CREATED_CONCEPT: GlossaryTerm = {
  description: 'Measures meaningful product engagement',
  displayName: 'Product Adoption',
  fullyQualifiedName: 'CustomerLifecycle.ProductAdoption',
  glossary: {
    id: GLOSSARY.id,
    name: GLOSSARY.name,
    type: 'glossary',
  },
  id: '11111111-1111-1111-1111-111111111111',
  name: 'ProductAdoption',
};

describe('OntologyConceptDraftInspector', () => {
  const onCancel = jest.fn();
  const onChange = jest.fn();
  const onCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens as a draft with glossary required in the side panel', () => {
    render(
      <OntologyConceptDraftInspector
        glossaries={[GLOSSARY]}
        isLeaseOwned={false}
        node={DRAFT_NODE}
        onCancel={onCancel}
        onChange={onChange}
        onCreated={onCreated}
      />
    );

    expect(
      screen.getByTestId('ontology-concept-draft-inspector')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-draft-glossary-field')).toBeVisible();
    expect(screen.getAllByText('label.field-required')).toHaveLength(3);
    expect(screen.getByTestId('ontology-draft-save')).toBeDisabled();
  });

  it('updates the draft node when glossary and name are filled', async () => {
    render(
      <OntologyConceptDraftInspector
        glossaries={[GLOSSARY]}
        isLeaseOwned={false}
        node={DRAFT_NODE}
        onCancel={onCancel}
        onChange={onChange}
        onCreated={onCreated}
      />
    );

    fireEvent.click(
      within(screen.getByTestId('ontology-draft-glossary-field')).getByRole(
        'button'
      )
    );
    fireEvent.click(await screen.findByRole('option', { name: GLOSSARY.name }));
    fireEvent.change(screen.getByRole('textbox', { name: /^label\.name/ }), {
      target: { value: 'ProductAdoption' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        glossaryId: GLOSSARY.id,
        group: GLOSSARY.name,
      })
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'ProductAdoption' })
    );
  });

  it('creates the concept after the required details and lease are ready', async () => {
    (addGlossaryTerm as jest.Mock).mockResolvedValue(CREATED_CONCEPT);

    render(
      <OntologyConceptDraftInspector
        isLeaseOwned
        glossaries={[GLOSSARY]}
        node={{ ...DRAFT_NODE, glossaryId: GLOSSARY.id }}
        onCancel={onCancel}
        onChange={onChange}
        onCreated={onCreated}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: /^label\.name/ }), {
      target: { value: 'ProductAdoption' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: /^label\.display-name/ }),
      { target: { value: 'Product Adoption' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: /^label\.description/ }),
      { target: { value: CREATED_CONCEPT.description } }
    );
    fireEvent.click(screen.getByTestId('ontology-draft-save'));

    await waitFor(() =>
      expect(addGlossaryTerm).toHaveBeenCalledWith({
        description: CREATED_CONCEPT.description,
        displayName: CREATED_CONCEPT.displayName,
        glossary: GLOSSARY.fullyQualifiedName,
        iri: undefined,
        name: CREATED_CONCEPT.name,
      })
    );

    expect(onCreated).toHaveBeenCalledWith(CREATED_CONCEPT);
  });

  it('creates the concept with properties authored in the draft panel', async () => {
    (addGlossaryTerm as jest.Mock).mockResolvedValue(CREATED_CONCEPT);

    render(
      <OntologyConceptDraftInspector
        isLeaseOwned
        glossaries={[GLOSSARY]}
        node={{ ...DRAFT_NODE, glossaryId: GLOSSARY.id }}
        onCancel={onCancel}
        onChange={onChange}
        onCreated={onCreated}
      />
    );

    fireEvent.click(screen.getByTestId('add-attribute'));
    fireEvent.change(
      within(screen.getByTestId('attribute-name-input')).getByRole('textbox'),
      { target: { value: 'subscriptionId' } }
    );
    fireEvent.click(screen.getByTestId('attribute-identifier-checkbox'));
    fireEvent.click(screen.getByTestId('save-attribute'));

    expect(
      screen.getByTestId('ontology-attribute-subscriptionId')
    ).toBeVisible();

    fireEvent.change(
      within(screen.getByTestId('ontology-draft-name-field')).getByRole(
        'textbox'
      ),
      { target: { value: CREATED_CONCEPT.name } }
    );
    fireEvent.change(
      within(screen.getByTestId('ontology-draft-description-field')).getByRole(
        'textbox'
      ),
      { target: { value: CREATED_CONCEPT.description } }
    );
    fireEvent.click(screen.getByTestId('ontology-draft-save'));

    await waitFor(() =>
      expect(addGlossaryTerm).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: [
            expect.objectContaining({
              dataType: DataType.String,
              isIdentifier: true,
              name: 'subscriptionId',
            }),
          ],
        })
      )
    );
  });
});
