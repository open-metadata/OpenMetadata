/*
 *  Copyright 2021 Collate
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
  findAllByTestId,
  findByTestId,
  fireEvent,
  render,
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
  customProperties: mockProperties,
  updateEntityType: mockUpdateEntityType,
};

describe('Test CustomField Table Component', () => {
  it('Should render table component', async () => {
    const { findByTestId, findAllByTestId } = render(
      <CustomPropertyTable {...mockProp} />
    );

    const table = await findByTestId('entity-custom-properties-table');

    expect(table).toBeInTheDocument();

    const tableHeader = await findByTestId('table-header');

    const tableBody = await findByTestId('table-body');

    expect(tableHeader).toBeInTheDocument();

    expect(tableBody).toBeInTheDocument();

    const dataRows = await findAllByTestId('data-row');

    expect(dataRows).toHaveLength(mockProperties.length);
  });

  it('Test delete property flow', async () => {
    const { container } = render(<CustomPropertyTable {...mockProp} />);

    const table = await findByTestId(
      container,
      'entity-custom-properties-table'
    );

    expect(table).toBeInTheDocument();

    const tableHeader = await findByTestId(container, 'table-header');

    const tableBody = await findByTestId(container, 'table-body');

    expect(tableHeader).toBeInTheDocument();

    expect(tableBody).toBeInTheDocument();

    const dataRows = await findAllByTestId(container, 'data-row');

    expect(dataRows).toHaveLength(mockProperties.length);

    const dataRow = dataRows[0];

    const deleteButton = await findByTestId(dataRow, 'delete-button');

    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    // confirmation modal should be visible on click of delete button
    const confirmationModal = await findByTestId(
      container,
      'confirmation-modal'
    );

    expect(confirmationModal).toBeInTheDocument();

    const confirmButton = await findByTestId(confirmationModal, 'save-button');

    fireEvent.click(confirmButton);

    // update type callback should get called on click of confirm button
    expect(mockUpdateEntityType).toHaveBeenCalled();
  });

  it('Should render no data row if there is no custom properties', async () => {
    const { findByTestId, queryAllByTestId } = render(
      <CustomPropertyTable {...mockProp} customProperties={[]} />
    );

    const table = await findByTestId('entity-custom-properties-table');

    expect(table).toBeInTheDocument();

    const tableHeader = await findByTestId('table-header');

    const tableBody = await findByTestId('table-body');

    expect(tableHeader).toBeInTheDocument();

    expect(tableBody).toBeInTheDocument();

    const dataRows = queryAllByTestId('data-row');

    expect(dataRows).toHaveLength(0);

    const noDataRow = await findByTestId('no-data-row');

    expect(noDataRow).toBeInTheDocument();
  });
});
