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
  Characteristic,
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import APIClient from '../../../../rest/axiosClient';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyPropertyEditor from './OntologyPropertyEditor';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../../rest/axiosClient', () => ({
  post: jest.fn(),
  patch: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

/** A new property submits with Create, an existing one with Save. */
const SUBMIT = /^label\.(save|create-entity)$/;
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

  it('marks edits unsaved and Cancel puts the saved values back', async () => {
    render(
      <OntologyPropertyEditor
        canEdit
        ontology={ontology}
        property={property}
        onSaved={jest.fn()}
      />
    );
    const displayName = screen.getByRole('textbox', {
      name: 'label.display-name',
    });
    const cancel = screen.getByRole('button', { name: 'label.cancel' });

    expect(cancel).toBeDisabled();

    fireEvent.change(displayName, { target: { value: 'Changed' } });

    expect(
      await screen.findByTestId('ontology-property-footer-status')
    ).toHaveTextContent('label.unsaved-changes');

    fireEvent.click(cancel);

    await waitFor(() => expect(displayName).not.toHaveValue('Changed'));

    expect(
      screen.getByTestId('ontology-property-footer-status')
    ).toHaveTextContent('label.no-unsaved-changes');
    expect(patch).not.toHaveBeenCalled();
  });

  it('creates an object property in its native ontology with a server-minted IRI', async () => {
    post.mockResolvedValue({ data: { ...property, kind: Kind.Object } });
    const saved = jest.fn();
    render(
      <OntologyPropertyEditor canEdit ontology={ontology} onSaved={saved} />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'purchasedBy' },
    });
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

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

  it('picks the domain by concept label and keeps a pasted IRI as a fallback', async () => {
    post.mockResolvedValue({ data: { ...property, kind: Kind.Object } });
    const saved = jest.fn();
    render(
      <OntologyPropertyEditor
        canEdit
        concepts={[
          { iri: 'urn:sales:customer', label: 'Customer' },
          { iri: 'urn:sales:order', label: 'Order' },
        ]}
        ontology={ontology}
        onSaved={saved}
      />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'purchasedBy' },
    });
    const domain = within(screen.getByTestId('ontology-property-domain'));
    const input = domain.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Cust' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /Customer/ }));
    fireEvent.click(domain.getByRole('button', { name: 'label.add' }));

    expect(
      domain.getByRole('button', { name: 'label.remove Customer' })
    ).toBeInTheDocument();

    const range = within(screen.getByTestId('ontology-property-range'));
    fireEvent.change(range.getByRole('combobox'), {
      target: { value: 'urn:other:Thing' },
    });
    fireEvent.click(range.getByRole('button', { name: 'label.add' }));
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(saved).toHaveBeenCalled());

    expect(post).toHaveBeenCalledWith(
      '/ontologyProperties',
      expect.objectContaining({
        domain: ['urn:sales:customer'],
        range: ['urn:other:Thing'],
      })
    );
  });

  it('adds a domain picked by concept label when Enter is pressed', async () => {
    render(
      <OntologyPropertyEditor
        canEdit
        concepts={[
          { iri: 'urn:sales:customer', label: 'Customer' },
          { iri: 'urn:sales:order', label: 'Order' },
        ]}
        ontology={ontology}
        onSaved={jest.fn()}
      />
    );
    const domain = within(screen.getByTestId('ontology-property-domain'));
    const input = domain.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Cust' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /Customer/ }));
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(
      domain.getByRole('button', { name: 'label.remove Customer' })
    ).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('rejects a pasted value that is not an IRI beside the field', () => {
    render(
      <OntologyPropertyEditor canEdit ontology={ontology} onSaved={jest.fn()} />
    );
    const domain = within(screen.getByTestId('ontology-property-domain'));
    fireEvent.change(domain.getByRole('textbox'), {
      target: { value: 'not an iri' },
    });

    expect(screen.getByText('message.invalid-concept-iri')).toBeInTheDocument();
    expect(domain.getByRole('button', { name: 'label.add' })).toBeDisabled();
  });

  it('offers data types as the range of a data property', async () => {
    render(
      <OntologyPropertyEditor
        canEdit
        ontology={ontology}
        property={{ ...property, domain: [], range: [] }}
        onSaved={jest.fn()}
      />
    );
    const range = within(screen.getByTestId('ontology-property-range'));
    const input = range.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'date' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(
      await screen.findByRole('option', { name: /dateTime/ })
    ).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

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
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

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
    fireEvent.click(screen.getByRole('radio', { name: /^label\.annotation/ }));

    expect(
      screen.queryByRole('textbox', { name: 'label.property-chain' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'label.unit' })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'note' },
    });
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

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
    fireEvent.click(screen.getByRole('radio', { name: /^label\.data/ }));
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));
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
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

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
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(
      screen.getByRole('textbox', { name: 'label.display-name' })
    ).toHaveValue('Customer status');
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
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

    expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: /^label\.value/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'label.add-entity' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'label.remove' })).toBeDisabled();
  });

  it('offers only same-kind properties as superproperties and sends the picked IRIs', async () => {
    post.mockResolvedValue({ data: { ...property, kind: Kind.Object } });
    const saved = jest.fn();
    render(
      <OntologyPropertyEditor
        canEdit
        ontology={ontology}
        properties={[
          {
            iri: 'urn:sales:hasRelative',
            label: 'Has relative',
            kind: Kind.Object,
          },
          { iri: 'urn:sales:code', label: 'Code', kind: Kind.Data },
        ]}
        onSaved={saved}
      />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'hasChild' },
    });
    const supers = within(
      screen.getByTestId('ontology-property-superProperties')
    );
    const input = supers.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'e' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(
      await screen.findByRole('option', { name: /Has relative/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /Code/ })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /Has relative/ }));
    fireEvent.click(supers.getByRole('button', { name: 'label.add' }));
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(saved).toHaveBeenCalled());

    expect(post).toHaveBeenCalledWith(
      '/ontologyProperties',
      expect.objectContaining({ superProperties: ['urn:sales:hasRelative'] })
    );
  });

  it('never offers a property as its own superproperty and saves a removed link', async () => {
    const hasChild: OntologyProperty = {
      ...property,
      name: 'hasChild',
      iri: 'urn:sales:hasChild',
      kind: Kind.Object,
      range: [],
      enumValues: undefined,
      superProperties: ['urn:sales:hasRelative'],
    };
    patch.mockImplementation(async (_path, operations) => ({
      data: applyPatch(
        structuredClone(hasChild),
        JSON.parse(JSON.stringify(operations)) as Operation[]
      ).newDocument,
    }));
    const saved = jest.fn();
    render(
      <OntologyPropertyEditor
        canEdit
        ontology={ontology}
        properties={[
          { iri: hasChild.iri, label: 'Has child', kind: Kind.Object },
          {
            iri: 'urn:sales:hasRelative',
            label: 'Has relative',
            kind: Kind.Object,
          },
        ]}
        property={hasChild}
        onSaved={saved}
      />
    );
    const supers = within(
      screen.getByTestId('ontology-property-superProperties')
    );
    fireEvent.click(
      supers.getByRole('button', { name: 'label.remove Has relative' })
    );
    const input = supers.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Has' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(
      await screen.findByRole('option', { name: /Has relative/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /Has child/ })
    ).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        expect.objectContaining({ superProperties: [] })
      )
    );
  });

  describe('AI mode', () => {
    beforeEach(() => (useIsAiMode as jest.Mock).mockReturnValue(true));

    afterEach(() => (useIsAiMode as jest.Mock).mockReturnValue(false));

    it('creates an object property with characteristics, inverse and chain from the advanced section', async () => {
      post.mockResolvedValue({ data: { ...property, kind: Kind.Object } });
      const saved = jest.fn();
      render(
        <OntologyPropertyEditor canEdit ontology={ontology} onSaved={saved} />
      );

      expect(screen.getByText('label.basics')).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', { name: 'label.display-name' })
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('ontology-property-domain')).getByRole(
          'textbox',
          { name: /^label\.property-domain/ }
        )
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('ontology-property-range')).getByRole(
          'textbox',
          { name: /^label\.range/ }
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', { name: 'label.property-iri' })
      ).toBeEnabled();

      fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
        target: { value: 'manages' },
      });
      fireEvent.click(
        screen.getByRole('checkbox', { name: Characteristic.Transitive })
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'label.inverse' }), {
        target: { value: 'urn:sales:managedBy' },
      });
      fireEvent.change(
        screen.getByRole('textbox', { name: 'label.property-chain' }),
        { target: { value: 'urn:sales:a\nurn:sales:b' } }
      );
      fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

      await waitFor(() => expect(saved).toHaveBeenCalled());

      expect(post).toHaveBeenCalledWith(
        '/ontologyProperties',
        expect.objectContaining({
          name: 'manages',
          kind: Kind.Object,
          characteristics: [Characteristic.Transitive],
          inverse: 'urn:sales:managedBy',
          propertyChain: ['urn:sales:a', 'urn:sales:b'],
        })
      );
    });

    it('reopens the advanced section on every save that leaves an advanced field invalid', async () => {
      render(
        <OntologyPropertyEditor
          canEdit
          ontology={ontology}
          onSaved={jest.fn()}
        />
      );
      const advanced = screen
        .getByText('label.advanced')
        .closest('details') as HTMLDetailsElement;
      fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
        target: { value: 'manages' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'label.inverse' }), {
        target: { value: 'not an iri' },
      });

      fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

      await waitFor(() => expect(advanced.open).toBe(true));

      advanced.open = false;
      fireEvent(advanced, new Event('toggle'));

      expect(advanced.open).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: SUBMIT }));

      await waitFor(() => expect(advanced.open).toBe(true));

      expect(post).not.toHaveBeenCalled();
    });

    it('keeps data-property values, unit and identifier editable and gated', () => {
      render(
        <OntologyPropertyEditor
          canEdit={false}
          ontology={ontology}
          property={property}
          onSaved={jest.fn()}
        />
      );

      expect(screen.getByRole('textbox', { name: /^label\.name/ })).toHaveValue(
        'status'
      );
      expect(
        screen.getByRole('textbox', { name: /^label\.value/ })
      ).toBeDisabled();
      expect(
        screen.getByRole('textbox', { name: 'label.unit' })
      ).toBeDisabled();
      expect(
        screen.getByRole('checkbox', { name: Characteristic.Functional })
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled();
    });
  });
});
