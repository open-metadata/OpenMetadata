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
import { applyPatch, Operation } from 'fast-json-patch';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import APIClient from '../../../../rest/axiosClient';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyPropertyEditor from './OntologyPropertyEditor';

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
const property: OntologyProperty = {
  id: 'property-id',
  name: 'status',
  fullyQualifiedName: 'Sales.status',
  iri: 'urn:sales:status',
  kind: Kind.Data,
  ontology: { id: ontology.id, type: 'ontology' },
  version: 0.2,
  owners: [{ id: 'owner', type: 'user' }],
  domain: ['urn:sales:customer'],
  range: ['http://www.w3.org/2001/XMLSchema#string'],
  enumValues: [
    { value: 'active', datatypeIri: 'http://www.w3.org/2001/XMLSchema#string' },
  ],
};

describe('OntologyPropertyEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an object property in its native ontology with a server-minted IRI', async () => {
    post.mockResolvedValue({ data: { ...property, kind: Kind.Object } });
    const saved = jest.fn();
    render(
      <OntologyPropertyEditor canEdit ontology={ontology} onSaved={saved} />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'purchasedBy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() => expect(saved).toHaveBeenCalled());

    expect(post).toHaveBeenCalledWith(
      '/ontologyProperties',
      expect.objectContaining({
        name: 'purchasedBy',
        kind: Kind.Object,
        ontology: 'Sales',
        iri: undefined,
      })
    );
  });

  it('edits a typed literal without changing identity, ownership or the datatype', async () => {
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(structuredClone(property), operations as Operation[])
        .newDocument,
    }));
    const saved = jest.fn();
    render(
      <OntologyPropertyEditor
        canEdit
        ontology={ontology}
        property={property}
        onSaved={saved}
      />
    );

    expect(screen.getByRole('textbox', { name: 'label.name' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'label.property-iri' })
    ).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /^label\.value/ }), {
      target: { value: ' pending ' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: /^label\.value/ }));
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        expect.objectContaining({
          id: property.id,
          iri: property.iri,
          owners: property.owners,
          enumValues: [
            {
              value: ' pending ',
              datatypeIri: property.enumValues?.[0].datatypeIri,
            },
          ],
        })
      )
    );

    expect(patch).toHaveBeenCalledWith(
      '/ontologyProperties/property-id',
      expect.arrayContaining([{ op: 'test', path: '/version', value: 0.2 }]),
      expect.anything()
    );
  });

  it('preserves property-chain order and repeated IRIs', async () => {
    post.mockResolvedValue({ data: property });
    render(
      <OntologyPropertyEditor canEdit ontology={ontology} onSaved={jest.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'walk' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.property-chain' }),
      { target: { value: 'urn:step\nurn:turn\nurn:step' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/ontologyProperties',
        expect.objectContaining({
          propertyChain: ['urn:step', 'urn:turn', 'urn:step'],
        })
      )
    );
  });

  it('does not offer object or data constraints on annotation properties', async () => {
    post.mockResolvedValue({ data: { ...property, kind: Kind.Annotation } });
    render(
      <OntologyPropertyEditor canEdit ontology={ontology} onSaved={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /label\.type$/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'ANNOTATION' }));

    expect(
      screen.queryByRole('textbox', { name: 'label.property-chain' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'label.unit' })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/ontologyProperties',
        expect.objectContaining({ kind: Kind.Annotation })
      )
    );
  });

  it('does not send hidden constraints after changing a new property kind', async () => {
    post.mockResolvedValue({ data: property });
    render(
      <OntologyPropertyEditor canEdit ontology={ontology} onSaved={jest.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'status' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'label.inverse' }), {
      target: { value: 'urn:inverse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /label\.type$/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'DATA' }));
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() => expect(post).toHaveBeenCalled());

    expect(post.mock.calls[0][1]).not.toHaveProperty('inverse');
    expect(post.mock.calls[0][1]).not.toHaveProperty('propertyChain');
  });

  it('rejects a relative literal datatype before writing', async () => {
    render(
      <OntologyPropertyEditor
        canEdit
        ontology={ontology}
        property={property}
        onSaved={jest.fn()}
      />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.data-type' }), {
      target: { value: 'relative/type' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    expect(
      await screen.findByText('message.invalid-concept-iri')
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('retains edits after a rejected concurrent update', async () => {
    patch.mockRejectedValue(new Error('Version changed'));
    render(
      <OntologyPropertyEditor
        canEdit
        ontology={ontology}
        property={property}
        onSaved={jest.fn()}
      />
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.display-name' }),
      { target: { value: 'Customer status' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(
      screen.getByRole('textbox', { name: 'label.display-name' })
    ).toHaveValue('Customer status');
    expect(screen.getByRole('button', { name: 'label.save' })).toBeEnabled();
  });

  it('gates writes and literal controls on edit permission', () => {
    render(
      <OntologyPropertyEditor
        canEdit={false}
        ontology={ontology}
        property={property}
        onSaved={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: /^label\.value/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'label.add-entity' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'label.remove' })).toBeDisabled();
  });
});
