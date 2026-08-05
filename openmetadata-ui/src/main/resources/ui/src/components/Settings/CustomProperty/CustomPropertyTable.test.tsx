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
import { descriptionTableObject } from '../../../utils/TableColumn.util';
import { CustomPropertyTable } from './CustomPropertyTable';

const ENTITY_CUSTOM_PROPERTIES_TABLE = 'entity-custom-properties-table';
const LABEL_NAME = 'label.name';
const LABEL_TYPE = 'label.type';
const LABEL_ACTION_PLURAL = 'label.action-plural';

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreview</p>);
});
jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<p>ErrorPlaceHolder</p>);
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
  isLoading: false,
  isButtonLoading: false,
};

describe('Test CustomField Table Component', () => {
  it('Should render table component', async () => {
    const { findByTestId, findByText, findAllByRole } = render(
      <CustomPropertyTable {...mockProp} />
    );

    const table = await findByTestId(ENTITY_CUSTOM_PROPERTIES_TABLE);

    expect(table).toBeInTheDocument();

    const tableCellName = await findByText(LABEL_NAME);
    const tableCellType = await findByText(LABEL_TYPE);

    const tableCellActions = await findByText(LABEL_ACTION_PLURAL);

    expect(tableCellName).toBeInTheDocument();
    expect(tableCellType).toBeInTheDocument();
    expect(descriptionTableObject).toHaveBeenCalledWith({ width: 300 });
    expect(tableCellActions).toBeInTheDocument();

    const tableRow = await findAllByRole('row');

    expect(tableRow).toHaveLength(mockProperties.length + 1);
  });

  it('Test delete property flow', async () => {
    await act(async () => {
      render(<CustomPropertyTable {...mockProp} />);
    });
    const table = await screen.findByTestId(ENTITY_CUSTOM_PROPERTIES_TABLE);

    expect(table).toBeInTheDocument();

    const tableCellName = await screen.findByText(LABEL_NAME);
    const tableCellType = await screen.findByText(LABEL_TYPE);
    const tableCellActions = await screen.findByText(LABEL_ACTION_PLURAL);

    expect(tableCellName).toBeInTheDocument();
    expect(tableCellType).toBeInTheDocument();
    expect(descriptionTableObject).toHaveBeenCalledWith({ width: 300 });
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

    const table = await findByTestId(ENTITY_CUSTOM_PROPERTIES_TABLE);

    expect(table).toBeInTheDocument();

    const tableCellName = await screen.findByText(LABEL_NAME);
    const tableCellType = await screen.findByText(LABEL_TYPE);

    const tableCellActions = await screen.findByText(LABEL_ACTION_PLURAL);

    expect(tableCellName).toBeInTheDocument();
    expect(tableCellType).toBeInTheDocument();
    expect(descriptionTableObject).toHaveBeenCalledWith({ width: 300 });
    expect(tableCellActions).toBeInTheDocument();

    const tableRow = await findAllByRole('row');

    expect(tableRow).toHaveLength(2);
  });
});
