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

import {
  act,
  findByTestId,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { CustomPropertyTable } from './CustomPropertyTable';

jest.mock('../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
  isEven: jest.fn().mockReturnValue(true),
}));

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreview</p>);
});

const mockUpdateEntityType = jest.fn();
const mockProperties = [
  {
    name: 'tableCreatedBy',
    description: 'To track of who created the table.',
    propertyType: {
      id: '1815eba0-a7e7-4880-8af5-8eee8710d279',
      type: 'type',
      name: 'string',
      fullyQualifiedName: 'string',
      description: '"A String type."',
      displayName: 'string',
      href: 'http://localhost:8585/api/v1/metadata/types/1815eba0-a7e7-4880-8af5-8eee8710d279',
    },
  },
  {
    name: 'tableUpdatedBy',
    description: 'To track who updated the table.',
    propertyType: {
      id: '1815eba0-a7e7-4880-8af5-8eee8710d279',
      type: 'type',
      name: 'string',
      fullyQualifiedName: 'string',
      description: '"A String type."',
      displayName: 'string',
      href: 'http://localhost:8585/api/v1/metadata/types/1815eba0-a7e7-4880-8af5-8eee8710d279',
    },
  },
];

const mockProp = {
  hasAccess: true,
  customProperties: mockProperties,
  updateEntityType: mockUpdateEntityType,
};

describe('Test CustomField Table Component', () => {
  it('Should render table component', async () => {
    const { findByTestId, findByText, findAllByRole } = render(
      <CustomPropertyTable {...mockProp} />
    );

    const table = await findByTestId('entity-custom-properties-table');

    expect(table).toBeInTheDocument();

    const tableCellName = await findByText('label.name');
    const tableCellType = await findByText('label.type');
    const tableCellDescription = await findByText('label.description');
    const tableCellActions = await findByText('label.action-plural');

    expect(tableCellName).toBeInTheDocument();
    expect(tableCellType).toBeInTheDocument();
    expect(tableCellDescription).toBeInTheDocument();
    expect(tableCellActions).toBeInTheDocument();

    const tableRow = await findAllByRole('row');

    expect(tableRow).toHaveLength(mockProperties.length + 1);
  });

  it('Test delete property flow', async () => {
    await act(async () => {
      render(<CustomPropertyTable {...mockProp} />);
    });
    const table = await screen.findByTestId('entity-custom-properties-table');

    expect(table).toBeInTheDocument();

    const tableCellName = await screen.findByText('label.name');
    const tableCellType = await screen.findByText('label.type');
    const tableCellDescription = await screen.findByText('label.description');
    const tableCellActions = await screen.findByText('label.action-plural');

    expect(tableCellName).toBeInTheDocument();
    expect(tableCellType).toBeInTheDocument();
    expect(tableCellDescription).toBeInTheDocument();
    expect(tableCellActions).toBeInTheDocument();

    const tableRow = await screen.findAllByRole('row');

    expect(tableRow).toHaveLength(mockProperties.length + 1);

    const dataRow = tableRow[1];

    const deleteButton = await findByTestId(dataRow, 'delete-button');

    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    // confirmation modal should be visible on click of delete button
    const confirmationModal = await screen.findByTestId('confirmation-modal');

    expect(confirmationModal).toBeInTheDocument();

    const confirmButton = await findByTestId(confirmationModal, 'save-button');

    fireEvent.click(confirmButton);

    // update type callback should get called on click of confirm button
    expect(mockUpdateEntityType).toHaveBeenCalled();
  });

  it('Should render no data row if there is no custom properties', async () => {
    const { findByTestId, findAllByRole } = render(
      <CustomPropertyTable {...mockProp} customProperties={[]} />
    );

    const table = await findByTestId('entity-custom-properties-table');

    expect(table).toBeInTheDocument();

    const tableCellName = await screen.findByText('label.name');
    const tableCellType = await screen.findByText('label.type');
    const tableCellDescription = await screen.findByText('label.description');
    const tableCellActions = await screen.findByText('label.action-plural');

    expect(tableCellName).toBeInTheDocument();
    expect(tableCellType).toBeInTheDocument();
    expect(tableCellDescription).toBeInTheDocument();
    expect(tableCellActions).toBeInTheDocument();

    const tableRow = await findAllByRole('row');

    expect(tableRow).toHaveLength(2);
  });
});
