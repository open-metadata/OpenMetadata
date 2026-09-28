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
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  DataType,
  OntologyAttribute,
} from '../../generated/type/ontologyAttribute';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { OntologyConceptAttributes } from './OntologyConceptAttributes.component';

jest.mock('../../rest/glossaryAPI', () => ({
  patchGlossaryTerm: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('generated-attribute-id'),
}));

const mockPatchGlossaryTerm = patchGlossaryTerm as jest.MockedFunction<
  typeof patchGlossaryTerm
>;

const TERM_ID = 'a2b1c3d4-0000-0000-0000-000000000001';

const ATTRIBUTES: OntologyAttribute[] = [
  {
    id: 'attr-1',
    name: 'supplierId',
    dataType: DataType.String,
    isIdentifier: true,
  },
  {
    id: 'attr-2',
    name: 'rating',
    dataType: DataType.Decimal,
    isIdentifier: false,
    unit: 'stars',
  },
];

const INHERITED_ATTRIBUTES: OntologyAttribute[] = [
  {
    id: 'attr-3',
    name: 'email',
    dataType: DataType.String,
    isIdentifier: false,
    inherited: true,
    declaringTerm: {
      id: 'b1c2d3e4-0000-0000-0000-000000000002',
      type: 'glossaryTerm',
      name: 'Person',
    },
  },
];

describe('OntologyConceptAttributes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPatchGlossaryTerm.mockResolvedValue({
      id: TERM_ID,
      attributes: ATTRIBUTES,
    } as unknown as GlossaryTerm);
  });

  it('renders attribute rows with identifier badge and data type token', () => {
    render(
      <OntologyConceptAttributes
        attributes={ATTRIBUTES}
        isEditMode={false}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-attributes')).toBeInTheDocument();
    expect(
      screen.getByTestId('ontology-attribute-supplierId')
    ).toHaveTextContent('label.identifier');
    expect(screen.getByTestId('ontology-attribute-rating')).toHaveTextContent(
      'decimal'
    );
    expect(screen.getByTestId('ontology-attribute-rating')).toHaveTextContent(
      'stars'
    );
  });

  it('renders inherited attributes read-only and names the concept declaring them', () => {
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={ATTRIBUTES}
        effectiveAttributes={[...ATTRIBUTES, ...INHERITED_ATTRIBUTES]}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    const inherited = screen.getByTestId('inherited-attribute-email');

    expect(inherited).toHaveTextContent('label.inherited-from');
    expect(inherited).toHaveTextContent('Person');
    expect(
      screen.queryByTestId('remove-attribute-email')
    ).not.toBeInTheDocument();
  });

  it('counts declared and inherited attributes together', () => {
    render(
      <OntologyConceptAttributes
        attributes={ATTRIBUTES}
        effectiveAttributes={[...ATTRIBUTES, ...INHERITED_ATTRIBUTES]}
        isEditMode={false}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-attributes')).toHaveTextContent('3');
  });

  it('renders only declared attributes when no effective set is supplied', () => {
    render(
      <OntologyConceptAttributes
        attributes={ATTRIBUTES}
        isEditMode={false}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('inherited-attribute-email')
    ).not.toBeInTheDocument();
  });

  it('hides authoring controls outside edit mode', () => {
    render(
      <OntologyConceptAttributes
        attributes={ATTRIBUTES}
        isEditMode={false}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    expect(screen.queryByTestId('add-attribute')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('remove-attribute-rating')
    ).not.toBeInTheDocument();
  });

  it('adds an attribute via the add flow and patches the term', async () => {
    const onTermUpdate = jest.fn();
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={[]}
        termId={TERM_ID}
        onTermUpdate={onTermUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('add-attribute'));
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'loyaltyTier' },
    });
    fireEvent.click(screen.getByTestId(`attribute-type-${DataType.Boolean}`));
    fireEvent.click(screen.getByTestId('save-attribute'));

    await waitFor(() => {
      expect(mockPatchGlossaryTerm).toHaveBeenCalledWith(TERM_ID, [
        {
          op: 'add',
          path: '/attributes',
          value: [
            {
              id: 'generated-attribute-id',
              name: 'loyaltyTier',
              dataType: DataType.Boolean,
              isIdentifier: false,
            },
          ],
        },
      ]);
    });

    expect(onTermUpdate).toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it('adds an attribute to a controlled concept draft without patching', () => {
    const onAttributesChange = jest.fn();
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={[]}
        variant="inspector"
        onAttributesChange={onAttributesChange}
      />
    );

    fireEvent.click(screen.getByTestId('add-attribute'));
    fireEvent.change(
      within(screen.getByTestId('attribute-name-input')).getByRole('textbox'),
      { target: { value: 'subscriptionId' } }
    );
    fireEvent.click(screen.getByTestId('attribute-identifier-checkbox'));
    fireEvent.change(
      within(screen.getByTestId('attribute-unit-input')).getByRole('textbox'),
      { target: { value: 'customer-id' } }
    );
    fireEvent.change(
      within(screen.getByTestId('attribute-description-input')).getByRole(
        'textbox'
      ),
      { target: { value: 'Stable subscription identifier' } }
    );
    fireEvent.click(screen.getByTestId('save-attribute'));

    expect(onAttributesChange).toHaveBeenCalledWith([
      {
        dataType: DataType.String,
        description: 'Stable subscription identifier',
        id: 'generated-attribute-id',
        isIdentifier: true,
        name: 'subscriptionId',
        unit: 'customer-id',
      },
    ]);
    expect(mockPatchGlossaryTerm).not.toHaveBeenCalled();
  });

  it('removes an attribute from a controlled concept draft', () => {
    const onAttributesChange = jest.fn();
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={ATTRIBUTES}
        variant="inspector"
        onAttributesChange={onAttributesChange}
      />
    );

    fireEvent.click(screen.getByTestId('remove-attribute-rating'));

    expect(onAttributesChange).toHaveBeenCalledWith([ATTRIBUTES[0]]);
    expect(mockPatchGlossaryTerm).not.toHaveBeenCalled();
  });

  it('appends to existing attributes as a full-array add patch', async () => {
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={ATTRIBUTES}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-attribute'));
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'country' },
    });
    fireEvent.click(screen.getByTestId('save-attribute'));

    await waitFor(() => expect(mockPatchGlossaryTerm).toHaveBeenCalled());

    const [, patch] = mockPatchGlossaryTerm.mock.calls[0];

    const operation = patch[0];

    expect(operation).toMatchObject({ op: 'add', path: '/attributes' });

    if (operation.op !== 'add') {
      throw new Error(`Expected add operation, received ${operation.op}`);
    }

    expect(operation.value).toHaveLength(ATTRIBUTES.length + 1);
  });

  it('rejects a duplicate attribute name without patching', async () => {
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={ATTRIBUTES}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-attribute'));
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'SUPPLIERID' },
    });
    fireEvent.click(screen.getByTestId('save-attribute'));

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.attribute-name-already-exists'
      );
    });

    expect(mockPatchGlossaryTerm).not.toHaveBeenCalled();
  });

  it('requires enum values when the enum data type is selected', async () => {
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={[]}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-attribute'));
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'certification' },
    });
    fireEvent.click(screen.getByTestId(`attribute-type-${DataType.Enum}`));
    fireEvent.click(screen.getByTestId('save-attribute'));

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalled();
    });

    expect(mockPatchGlossaryTerm).not.toHaveBeenCalled();
  });

  it('removes an attribute with a full-array add patch', async () => {
    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={ATTRIBUTES}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('remove-attribute-rating'));

    await waitFor(() => {
      expect(mockPatchGlossaryTerm).toHaveBeenCalledWith(TERM_ID, [
        {
          op: 'add',
          path: '/attributes',
          value: [ATTRIBUTES[0]],
        },
      ]);
    });
  });

  it('surfaces the server error object when a patch fails', async () => {
    const axiosError = {
      config: {},
      response: { data: { message: 'attribute name is invalid' } },
    };
    mockPatchGlossaryTerm.mockRejectedValueOnce(axiosError);

    render(
      <OntologyConceptAttributes
        isEditMode
        attributes={[]}
        termId={TERM_ID}
        onTermUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-attribute'));
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: 'country' },
    });
    fireEvent.click(screen.getByTestId('save-attribute'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        axiosError,
        expect.any(String)
      )
    );
  });
});
