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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ENUM_CONFIG_MAX_VISIBLE_VALUES } from '../../../../constants/CustomProperty.constants';
import { CustomProperty } from '../../../../generated/type/customProperty';
import EditCustomPropertyModal from './EditCustomPropertyModal';

jest.mock('../../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="description-editor" />)
);

const HIDDEN_VALUE_COUNT = 5;
const enumValues = Array.from(
  { length: ENUM_CONFIG_MAX_VISIBLE_VALUES + HIDDEN_VALUE_COUNT },
  (_, index) => `value-${index}`
);

const largeEnumProperty: CustomProperty = {
  name: 'largeEnum',
  displayName: 'Large Enum',
  description: 'Large enum',
  propertyType: { id: 'enum', type: 'type', name: 'enum' },
  customPropertyConfig: {
    config: { multiSelect: true, values: enumValues },
  },
};

describe('EditCustomPropertyModal', () => {
  it('renders a capped number of enum value tags and counts the rest', () => {
    render(
      <EditCustomPropertyModal
        customProperty={largeEnumProperty}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('edit-custom-property-modal')
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('autocomplete-selected-item')).toHaveLength(
      ENUM_CONFIG_MAX_VISIBLE_VALUES
    );
    expect(screen.getByText(`+${HIDDEN_VALUE_COUNT}`)).toBeInTheDocument();
  });

  it('saves every enum value, including the ones not drawn as tags', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <EditCustomPropertyModal
        customProperty={largeEnumProperty}
        onCancel={jest.fn()}
        onSave={onSave}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-custom-property-save'));
    });

    expect(onSave).toHaveBeenCalledWith({
      displayName: 'Large Enum',
      description: 'Large enum',
      customPropertyConfig: {
        config: { multiSelect: true, values: enumValues },
      },
    });
  });

  it('closes through onCancel', () => {
    const onCancel = jest.fn();

    render(
      <EditCustomPropertyModal
        customProperty={largeEnumProperty}
        onCancel={onCancel}
        onSave={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('edit-custom-property-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('blocks saving an enum with no values', async () => {
    const onSave = jest.fn();

    render(
      <EditCustomPropertyModal
        customProperty={{
          ...largeEnumProperty,
          customPropertyConfig: {
            config: { multiSelect: false, values: ['only'] },
          },
        }}
        onCancel={jest.fn()}
        onSave={onSave}
      />
    );

    fireEvent.click(
      within(screen.getByTestId('autocomplete-selected-item')).getByRole(
        'button'
      )
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-custom-property-save'));
    });

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows saved entity reference types without a remove button', () => {
    render(
      <EditCustomPropertyModal
        customProperty={{
          name: 'steward',
          description: 'Data steward',
          propertyType: {
            id: 'ref',
            type: 'type',
            name: 'entityReferenceList',
          },
          customPropertyConfig: { config: ['user'] },
        }}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />
    );

    const savedType = screen.getByTestId('autocomplete-selected-item');

    expect(savedType).toHaveTextContent('User');
    expect(within(savedType).queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'message.updating-existing-not-possible-can-add-new-values'
      )
    ).toBeInTheDocument();
  });
});
