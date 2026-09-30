/*
 *  Copyright 2022 Collate.
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
import { CustomProperty } from '../../../generated/type/customProperty';
import { CustomPropertyTable } from './CustomPropertyTable';

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<p>ErrorPlaceHolder</p>);
});

jest.mock('./EditCustomPropertyModal/EditCustomPropertyModal', () => {
  return jest
    .fn()
    .mockImplementation(({ customProperty }) => (
      <div data-testid="edit-modal">{customProperty.name}</div>
    ));
});

const propertyType = (name: string) => ({
  id: `${name}-id`,
  type: 'type',
  name,
  fullyQualifiedName: name,
  displayName: name,
});

const mockProperties: CustomProperty[] = [
  {
    name: 'tableCreatedBy',
    description: 'To track of who created the table.',
    propertyType: propertyType('string'),
  },
  {
    name: 'priority',
    description: '<p>Business <strong>priority</strong></p>',
    propertyType: propertyType('enum'),
    customPropertyConfig: {
      config: {
        multiSelect: true,
        values: ['High', 'Low', 'Medium', 'Critical', 'Trivial'],
      },
    },
  },
  {
    name: 'steward',
    description: 'Data steward',
    propertyType: propertyType('entityReferenceList'),
    customPropertyConfig: { config: ['user', 'team'] },
  },
  {
    name: 'accessMatrix',
    description: 'Access matrix',
    propertyType: propertyType('table-cp'),
    customPropertyConfig: { config: { columns: ['Id', 'Name'] } },
  },
];

const mockOnDeleteProperty = jest.fn();
const mockOnUpdateProperty = jest.fn();

const mockProp = {
  hasAccess: true,
  customProperties: mockProperties,
  onDeleteProperty: mockOnDeleteProperty,
  onUpdateProperty: mockOnUpdateProperty,
  isLoading: false,
  isButtonLoading: false,
};

const getRow = (name: string) =>
  screen
    .getAllByRole('row')
    .find((row) => row.getAttribute('data-row-key') === name) as HTMLElement;

describe('CustomPropertyTable', () => {
  it('renders the property, type and configuration columns', () => {
    render(<CustomPropertyTable {...mockProp} />);

    expect(
      screen.getByTestId('entity-custom-properties-table')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'label.property' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'label.type' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'label.configuration' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(mockProperties.length + 1);
  });

  it('shows the description as plain text under the property name', () => {
    render(<CustomPropertyTable {...mockProp} />);

    const row = getRow('priority');

    expect(within(row).getByTestId('property-name')).toHaveTextContent(
      'priority'
    );
    expect(within(row).getByTestId('property-description')).toHaveTextContent(
      'Business priority'
    );
  });

  it('shows a dash when the property has no configuration', () => {
    render(<CustomPropertyTable {...mockProp} />);

    const row = getRow('tableCreatedBy');

    expect(within(row).getByTestId('property-type')).toHaveTextContent(
      'label.string'
    );
    expect(within(row).getByTestId('no-config')).toHaveTextContent('—');
  });

  it('caps enum values at three chips and counts the rest', () => {
    render(<CustomPropertyTable {...mockProp} />);

    const config = within(getRow('priority')).getByTestId('enum-config');

    expect(config).toHaveTextContent('label.value-plural · label.multi-select');
    expect(
      within(config)
        .getAllByTestId('config-value')
        .map((chip) => chip.textContent)
    ).toEqual(['High', 'Low', 'Medium']);
    expect(within(config).getByTestId('config-hidden-count')).toHaveTextContent(
      'label.plus-count'
    );
  });

  it('lists entity types and table columns as chips', () => {
    render(<CustomPropertyTable {...mockProp} />);

    const entityConfig = within(getRow('steward')).getByTestId(
      'steward-config'
    );
    const tableConfig = within(getRow('accessMatrix')).getByTestId(
      'table-config'
    );

    expect(entityConfig).toHaveTextContent('label.entity-types');
    expect(
      within(entityConfig)
        .getAllByTestId('config-value')
        .map((chip) => chip.textContent)
    ).toEqual(['User', 'Team']);
    expect(tableConfig).toHaveTextContent('label.column-plural');
    expect(
      within(tableConfig)
        .getAllByTestId('config-value')
        .map((chip) => chip.textContent)
    ).toEqual(['Id', 'Name']);
  });

  it('sorts rows by property name when the header is pressed', async () => {
    render(<CustomPropertyTable {...mockProp} />);

    const rowKeys = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.getAttribute('data-row-key'));

    expect(rowKeys()).toEqual(mockProperties.map(({ name }) => name));

    fireEvent.click(
      screen.getByRole('columnheader', { name: 'label.property' })
    );

    expect(rowKeys()).toEqual([
      'accessMatrix',
      'priority',
      'steward',
      'tableCreatedBy',
    ]);

    fireEvent.click(
      screen.getByRole('columnheader', { name: 'label.property' })
    );

    expect(rowKeys()).toEqual([
      'tableCreatedBy',
      'steward',
      'priority',
      'accessMatrix',
    ]);
  });

  it('deletes the property picked from the row menu', async () => {
    render(<CustomPropertyTable {...mockProp} />);

    fireEvent.click(within(getRow('priority')).getByTestId('property-actions'));
    fireEvent.click(await screen.findByTestId('delete-button'));

    const confirmationModal = await screen.findByTestId('confirmation-modal');

    await act(async () => {
      fireEvent.click(within(confirmationModal).getByTestId('save-button'));
    });

    expect(mockOnDeleteProperty).toHaveBeenCalledWith('priority');
  });

  it('opens the edit modal for the property picked from the row menu', async () => {
    render(<CustomPropertyTable {...mockProp} />);

    fireEvent.click(within(getRow('steward')).getByTestId('property-actions'));
    fireEvent.click(await screen.findByTestId('edit-button'));

    expect(await screen.findByTestId('edit-modal')).toHaveTextContent(
      'steward'
    );
  });

  it('disables the row menu without edit access', () => {
    render(<CustomPropertyTable {...mockProp} hasAccess={false} />);

    expect(
      within(getRow('priority')).getByTestId('property-actions')
    ).toBeDisabled();
  });

  it('renders the empty placeholder when there are no properties', () => {
    render(<CustomPropertyTable {...mockProp} customProperties={[]} />);

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('masks the rows with a loader while loading', () => {
    render(<CustomPropertyTable {...mockProp} isLoading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });
});
