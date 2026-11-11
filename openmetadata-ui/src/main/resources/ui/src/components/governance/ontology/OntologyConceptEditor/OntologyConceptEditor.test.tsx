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
  act,
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
import { useIsAiMode } from '../../../../hooks/useAppMode';
import APIClient from '../../../../rest/axiosClient';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyConceptEditor from './OntologyConceptEditor';

jest.mock('../../../../rest/axiosClient', () => ({
  patch: jest.fn(),
  get: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

const patch = APIClient.patch as jest.MockedFunction<typeof APIClient.patch>;
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
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
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockResolvedValue({ data: { data: [], paging: { total: 0 } } });
  });

  it('saves the selected vocabulary kind as a schema enum', async () => {
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(structuredClone(concept), operations as Operation[])
        .newDocument,
    }));
    render(
      <OntologyConceptEditor
        canEdit
        concept={concept}
        ontology={ontology}
        onSaved={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /label\.type$/ })
    ).toHaveTextContent('OWL_CLASS');

    fireEvent.click(screen.getByRole('button', { name: /label\.type$/ }));
    fireEvent.click(
      await screen.findByRole('option', { name: 'SKOS_CONCEPT' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/ontologyConcepts/concept-id',
        expect.arrayContaining([
          { op: 'replace', path: '/conceptType', value: 'SKOS_CONCEPT' },
        ]),
        expect.anything()
      )
    );
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

  it('maps a concept by searching its label and keeps a pasted IRI', async () => {
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(structuredClone(concept), operations as Operation[])
        .newDocument,
    }));
    render(
      <OntologyConceptEditor
        canEdit
        concept={concept}
        concepts={[
          { iri: 'urn:sales:customer', label: 'Customer' },
          { iri: 'urn:sales:order', label: 'Order' },
        ]}
        ontology={ontology}
        onSaved={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.add-mapping' }));
    const input = within(
      screen.getByTestId('ontology-concept-mapping')
    ).getByRole('combobox', { name: /^label\.concept-iri/ });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Ord' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /Order/ }));
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() => expect(patch).toHaveBeenCalled());

    expect(JSON.stringify(patch.mock.calls[0][1])).toContain('urn:sales:order');
  });

  it('maps to a concept in another readable ontology, showing which ontology it is in', async () => {
    get.mockResolvedValue({
      data: {
        data: [
          {
            ...concept,
            id: 'other-id',
            name: 'Account',
            iri: 'urn:finance:account',
            ontology: { id: 'finance-id', type: 'ontology', name: 'Finance' },
          },
        ],
        paging: { total: 1 },
      },
    });
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(structuredClone(concept), operations as Operation[])
        .newDocument,
    }));
    render(
      <OntologyConceptEditor
        canEdit
        concept={concept}
        concepts={[{ iri: 'urn:sales:order', label: 'Order' }]}
        ontology={ontology}
        onSaved={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.add-mapping' }));
    const input = within(
      screen.getByTestId('ontology-concept-mapping')
    ).getByRole('combobox', { name: /^label\.concept-iri/ });
    await waitFor(() => expect(get).toHaveBeenCalled());
    await act(async () => undefined);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Acc' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const option = await screen.findByRole('option', { name: /Account/ });

    expect(option).toHaveTextContent('Finance · urn:finance:account');

    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());

    expect(JSON.stringify(patch.mock.calls[0][1])).toContain(
      'urn:finance:account'
    );
  });

  it('validates and saves external mappings with their scheme and source', async () => {
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(structuredClone(concept), operations as Operation[])
        .newDocument,
    }));
    render(
      <OntologyConceptEditor
        canEdit
        concept={concept}
        ontology={ontology}
        onSaved={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.add-mapping' }));
    const mapping = within(screen.getByTestId('ontology-concept-mapping'));
    fireEvent.change(
      mapping.getByRole('combobox', { name: /^label\.concept-iri/ }),
      {
        target: { value: 'relative/concept' },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    expect(
      await mapping.findByText('message.invalid-concept-iri')
    ).toBeVisible();
    expect(patch).not.toHaveBeenCalled();

    fireEvent.change(
      mapping.getByRole('combobox', { name: /^label\.concept-iri/ }),
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
      expect(patch).toHaveBeenCalledWith(
        '/ontologyConcepts/concept-id',
        expect.arrayContaining([
          {
            op: 'add',
            path: '/conceptMappings',
            value: [
              {
                conceptIri: 'https://example.org/Customer',
                mappingType: ConceptMappingType.ExactMatch,
                schemeIri: 'https://example.org/vocabulary',
                source: 'External vocabulary',
              },
            ],
          },
        ]),
        expect.anything()
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
      mapping.getByRole('combobox', { name: /^label\.concept-iri/ }),
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
      mapping.getByRole('combobox', { name: /^label\.concept-iri/ })
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
      mapping.getByRole('combobox', { name: /^label\.concept-iri/ })
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

  describe('in AI mode', () => {
    beforeEach(() => (useIsAiMode as jest.Mock).mockReturnValue(true));

    afterEach(() => (useIsAiMode as jest.Mock).mockReturnValue(false));

    it('adds and removes a mapping and saves the concept', async () => {
      patch.mockImplementation(async (_path, operations) => ({
        data: applyPatch(structuredClone(concept), operations as Operation[])
          .newDocument,
      }));
      const onSaved = jest.fn();
      render(
        <OntologyConceptEditor
          canEdit
          concept={concept}
          ontology={ontology}
          onSaved={onSaved}
        />
      );

      expect(screen.getByTestId('concept-save-status')).toHaveTextContent(
        'label.all-changes-saved'
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'label.add-mapping' })
      );

      expect(screen.getByTestId('ontology-concept-mapping')).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'label.remove' }));

      expect(
        screen.queryByTestId('ontology-concept-mapping')
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'label.add-mapping' })
      ).toHaveFocus();

      fireEvent.change(
        screen.getByRole('textbox', { name: 'label.display-name' }),
        { target: { value: 'Customers' } }
      );

      expect(screen.getByTestId('concept-save-status')).toHaveTextContent(
        'label.unsaved-changes'
      );

      fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
      await waitFor(() =>
        expect(onSaved).toHaveBeenCalledWith(
          expect.objectContaining({ displayName: 'Customers' })
        )
      );
    });

    it('keeps every control disabled without edit permission', () => {
      render(
        <OntologyConceptEditor
          canEdit={false}
          concept={concept}
          ontology={ontology}
          onSaved={jest.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'label.add-mapping' })
      ).toBeDisabled();
      expect(
        screen.getByRole('textbox', { name: 'label.display-name' })
      ).toBeDisabled();
    });
  });
});
