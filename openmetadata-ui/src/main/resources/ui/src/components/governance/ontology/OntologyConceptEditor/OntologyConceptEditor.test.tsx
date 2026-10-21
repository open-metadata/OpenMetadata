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
import { applyPatch, Operation } from 'fast-json-patch';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  ConceptMappingType,
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import APIClient from '../../../../rest/axiosClient';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyConceptEditor from './OntologyConceptEditor';

jest.mock('../../../../rest/axiosClient', () => ({
  post: jest.fn(),
  patch: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
const patch = APIClient.patch as jest.MockedFunction<typeof APIClient.patch>;
const ontology: Ontology = {
  id: 'ontology-id',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const concept: OntologyConcept = {
  id: 'concept-id',
  name: 'Customer',
  fullyQualifiedName: 'Sales.Customer',
  iri: 'urn:sales:customer',
  conceptType: OntologyConceptType.OwlClass,
  ontology: { id: ontology.id, type: 'ontology' },
  version: 0.1,
  owners: [{ id: 'owner', type: 'user' }],
  synonyms: ['Client'],
};

describe('OntologyConceptEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves the selected vocabulary kind as a schema enum', async () => {
    post.mockResolvedValue({ data: concept });
    render(
      <OntologyConceptEditor canEdit ontology={ontology} onSaved={jest.fn()} />
    );

    expect(
      screen.getByRole('button', { name: /label\.type$/ })
    ).toHaveTextContent('OWL_CLASS');

    fireEvent.click(screen.getByRole('button', { name: /label\.type$/ }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'SKOS_CONCEPT' })
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'Customer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/ontologyConcepts',
        expect.objectContaining({
          conceptType: OntologyConceptType.SkosConcept,
        })
      )
    );
  });

  it('creates an independent concept and leaves IRI minting to the server', async () => {
    const saved = jest.fn();
    post.mockResolvedValue({ data: concept });
    render(
      <OntologyConceptEditor canEdit ontology={ontology} onSaved={saved} />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: ' Customer ' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.description' }),
      { target: { value: 'A customer' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() => expect(saved).toHaveBeenCalledWith(concept));

    expect(post).toHaveBeenCalledWith('/ontologyConcepts', {
      name: 'Customer',
      ontology: 'Sales',
      conceptType: OntologyConceptType.OwlClass,
      displayName: undefined,
      description: 'A customer',
      iri: undefined,
      synonyms: [],
      conceptMappings: [],
    });
  });

  it('updates editable fields with a version precondition and preserves unrelated metadata', async () => {
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(structuredClone(concept), operations as Operation[])
        .newDocument,
    }));
    const saved = jest.fn();
    render(
      <OntologyConceptEditor
        canEdit
        concept={concept}
        ontology={ontology}
        onSaved={saved}
      />
    );

    expect(screen.getByRole('textbox', { name: 'label.name' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'label.concept-iri' })
    ).toBeDisabled();

    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.display-name' }),
      { target: { value: 'Customers' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        expect.objectContaining({
          id: concept.id,
          iri: concept.iri,
          name: concept.name,
          displayName: 'Customers',
          owners: concept.owners,
          synonyms: ['Client'],
        })
      )
    );

    expect(patch).toHaveBeenCalledWith(
      '/ontologyConcepts/concept-id',
      expect.arrayContaining([
        { op: 'test', path: '/version', value: 0.1 },
        { op: 'add', path: '/displayName', value: 'Customers' },
      ]),
      expect.anything()
    );
  });

  it('rejects a relative IRI before saving', async () => {
    render(
      <OntologyConceptEditor canEdit ontology={ontology} onSaved={jest.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'Customer' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.concept-iri' }),
      { target: { value: 'relative/iri' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    expect(
      await screen.findByText('message.invalid-concept-iri')
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('validates and saves external mappings with their scheme and source', async () => {
    post.mockResolvedValue({ data: concept });
    const saved = jest.fn();
    render(
      <OntologyConceptEditor canEdit ontology={ontology} onSaved={saved} />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'Customer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.add-mapping' }));
    const mapping = within(screen.getByTestId('ontology-concept-mapping'));
    fireEvent.change(
      mapping.getByRole('textbox', { name: 'label.concept-iri' }),
      {
        target: { value: 'relative/concept' },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    expect(
      await mapping.findByText('message.invalid-concept-iri')
    ).toBeVisible();
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(
      mapping.getByRole('textbox', { name: 'label.concept-iri' }),
      {
        target: { value: ' https://example.org/Customer ' },
      }
    );
    fireEvent.change(
      mapping.getByRole('textbox', { name: 'label.scheme-iri' }),
      {
        target: { value: 'https://example.org/vocabulary' },
      }
    );
    fireEvent.change(mapping.getByRole('textbox', { name: 'label.source' }), {
      target: { value: 'External vocabulary' },
    });
    await waitFor(() =>
      expect(
        mapping.queryByText('message.invalid-concept-iri')
      ).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/ontologyConcepts',
        expect.objectContaining({
          conceptMappings: [
            {
              conceptIri: 'https://example.org/Customer',
              mappingType: ConceptMappingType.ExactMatch,
              schemeIri: 'https://example.org/vocabulary',
              source: 'External vocabulary',
            },
          ],
        })
      )
    );
  });

  it('edits and removes mappings without changing concept identity or ownership', async () => {
    const mapped = {
      ...concept,
      conceptMappings: [
        {
          conceptIri: 'urn:external:Customer',
          mappingType: ConceptMappingType.CloseMatch,
          schemeIri: 'urn:external:',
          source: 'Standard',
        },
        {
          conceptIri: 'urn:retired:Customer',
          mappingType: ConceptMappingType.RelatedMatch,
        },
      ],
    };
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(structuredClone(mapped), operations as Operation[])
        .newDocument,
    }));
    const saved = jest.fn();
    render(
      <OntologyConceptEditor
        canEdit
        concept={mapped}
        ontology={ontology}
        onSaved={saved}
      />
    );
    const rows = screen.getAllByTestId('ontology-concept-mapping');
    const first = within(rows[0]);

    expect(
      first.getByRole('textbox', { name: 'label.scheme-iri' })
    ).toHaveValue('urn:external:');

    fireEvent.click(
      first.getByRole('button', { name: /label\.mapping-type$/ })
    );
    fireEvent.click(
      await screen.findByRole('option', { name: ConceptMappingType.ExactMatch })
    );
    fireEvent.click(
      within(rows[1]).getByRole('button', { name: 'label.remove' })
    );

    expect(
      screen.getByRole('button', { name: 'label.add-mapping' })
    ).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith({
        ...mapped,
        conceptMappings: [
          {
            ...mapped.conceptMappings[0],
            mappingType: ConceptMappingType.ExactMatch,
          },
        ],
      })
    );

    expect(patch.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        { op: 'test', path: '/version', value: concept.version },
      ])
    );
  });

  it('retains mappings after a server validation failure', async () => {
    patch.mockRejectedValue(new Error('Class concepts cannot use sameAs'));
    const saved = jest.fn();
    render(
      <OntologyConceptEditor
        canEdit
        concept={concept}
        ontology={ontology}
        onSaved={saved}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.add-mapping' }));
    const mapping = within(screen.getByTestId('ontology-concept-mapping'));
    fireEvent.change(
      mapping.getByRole('textbox', { name: 'label.concept-iri' }),
      {
        target: { value: 'urn:external:Customer' },
      }
    );
    fireEvent.click(
      mapping.getByRole('button', { name: /label\.mapping-type$/ })
    );
    fireEvent.click(
      await screen.findByRole('option', { name: ConceptMappingType.SameAs })
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(saved).not.toHaveBeenCalled();
    expect(
      mapping.getByRole('textbox', { name: 'label.concept-iri' })
    ).toHaveValue('urn:external:Customer');
    expect(
      mapping.getByRole('button', { name: /label\.mapping-type$/ })
    ).toHaveTextContent(ConceptMappingType.SameAs);
    expect(screen.getByRole('button', { name: 'label.save' })).toBeEnabled();
  });

  it('retains an edited definition when a concurrent update rejects the save', async () => {
    const error = new Error('Version changed');
    patch.mockRejectedValue(error);
    const saved = jest.fn();
    render(
      <OntologyConceptEditor
        canEdit
        concept={concept}
        ontology={ontology}
        onSaved={saved}
      />
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.display-name' }),
      { target: { value: 'Customers' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(saved).not.toHaveBeenCalled();
    expect(
      screen.getByRole('textbox', { name: 'label.display-name' })
    ).toHaveValue('Customers');
    expect(screen.getByRole('button', { name: 'label.save' })).toBeEnabled();
  });

  it('does not permit writes without edit permission', () => {
    render(
      <OntologyConceptEditor
        canEdit={false}
        concept={{
          ...concept,
          conceptMappings: [
            {
              conceptIri: 'urn:external:Customer',
              mappingType: ConceptMappingType.CloseMatch,
            },
          ],
        }}
        ontology={ontology}
        onSaved={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'label.display-name' })
    ).toBeDisabled();
    expect(patch).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'label.add-mapping' })
    ).toBeDisabled();

    const mapping = within(screen.getByTestId('ontology-concept-mapping'));

    expect(
      mapping.getByRole('textbox', { name: 'label.concept-iri' })
    ).toBeDisabled();
    expect(
      mapping.getByRole('textbox', { name: 'label.scheme-iri' })
    ).toBeDisabled();
    expect(
      mapping.getByRole('textbox', { name: 'label.source' })
    ).toBeDisabled();
    expect(
      mapping.getByRole('button', { name: /label\.mapping-type$/ })
    ).toBeDisabled();
    expect(
      mapping.getByRole('button', { name: 'label.remove' })
    ).toBeDisabled();
  });
});
