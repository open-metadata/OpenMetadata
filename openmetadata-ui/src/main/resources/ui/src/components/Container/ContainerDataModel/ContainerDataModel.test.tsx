/*
 *  Copyright 2023 Collate.
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
  findAllByTestId,
  findByTestId,
  findByText,
  queryByTestId,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Column } from '../../../generated/entity/data/container';
import ContainerDataModel from './ContainerDataModel';

const props = {
  dataModel: {
    isPartitioned: false,
    columns: [
      {
        name: 'department_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the department. This column is the primary key for this table.',
        fullyQualifiedName: 's3_storage_sample.finance.department_id',
        tags: [],
        constraint: 'PRIMARY_KEY',
        ordinalPosition: 1,
      },
      {
        name: 'budget_total_value',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description: "The department's budget for the current year.",
        fullyQualifiedName: 's3_storage_sample.finance.budget_total_value',
        tags: [],
        ordinalPosition: 2,
      },
      {
        name: 'notes',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Notes concerning sustainability for the budget.',
        fullyQualifiedName: 's3_storage_sample.finance.notes',
        tags: [],
        ordinalPosition: 3,
      },
      {
        name: 'budget_executor',
        dataType: 'VARCHAR',
        dataTypeDisplay: 'varchar',
        description: 'The responsible finance lead for the budget execution',
        fullyQualifiedName: 's3_storage_sample.finance.budget_executor',
        tags: [],
        ordinalPosition: 4,
      },
    ] as Column[],
  },
  hasDescriptionEditAccess: true,
  hasTagEditAccess: true,
  hasGlossaryTermEditAccess: true,
  isReadOnly: false,
  onUpdate: jest.fn(),
  entityFqn: 's3_storage_sample.departments',
  entityFieldThreads: [
    {
      entityLink:
        '<#E::container::s3_storage_sample.departments.finance.expenditures::dataModel::columns::department_id::description>',
      count: 2,
      entityField: 'dataModel::columns::department_id::description',
    },
  ],
  onThreadLinkSelect: jest.fn(),
};

jest.mock('../../../utils/TagsUtils', () => ({
  getAllTagsList: jest.fn(() => Promise.resolve([])),
  getTagsHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../utils/GlossaryUtils', () => ({
  getGlossaryTermsList: jest.fn(() => Promise.resolve([])),
  getGlossaryTermHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    type: 'container',
  }),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn(),
  getTableColumnConfigSelections: jest
    .fn()
    .mockReturnValue([
      'name',
      'description',
      'dataTypeDisplay',
      'tags',
      'glossary',
    ]),
  handleUpdateTableColumnSelections: jest.fn(),
  pruneEmptyChildren: jest.fn().mockImplementation((value) => value),
}));

jest.mock('../../../utils/TableTags/TableTags.utils', () => ({
  ...jest.requireActual('../../../utils/TableTags/TableTags.utils'),
  getFilterTags: jest.fn().mockReturnValue({
    Classification: [],
    Glossary: [],
  }),
}));

jest.mock('../../../utils/ContainerDetailUtils', () => ({
  updateContainerColumnDescription: jest.fn(),
  updateContainerColumnTags: jest.fn(),
}));

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewNew',
  () =>
    jest
      .fn()
      .mockReturnValue(
        <div data-testid="description-preview">Description Preview</div>
      )
);

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<div data-testid="editor-modal">Editor Modal</div>),
  })
);

jest.mock('../../Database/TableTags/TableTags.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="table-tag-container">Table Tag Container</div>
    ))
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="error-placeholder">ErrorPlaceHolder</div>
    ))
);

describe('ContainerDataModel', () => {
  it('Should render the Container data model component', async () => {
    render(
      <MemoryRouter>
        <ContainerDataModel {...props} />
      </MemoryRouter>
    );

    const containerDataModel = await screen.findByTestId(
      'container-data-model-table'
    );
    const rows = await screen.findAllByRole('row');

    const row1 = rows[1];

    expect(containerDataModel).toBeInTheDocument();

    // should render header row and content row
    expect(rows).toHaveLength(5);

    const name = await findByText(row1, 'department_id');
    const dataType = await findByText(row1, 'numeric');
    const description = await findByText(row1, 'Description Preview');
    const tagsContainer = await findAllByTestId(row1, 'table-tag-container');

    expect(name).toBeInTheDocument();
    expect(dataType).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tagsContainer).toHaveLength(2);
  });

  it('On edit description button click modal editor should render', async () => {
    render(
      <MemoryRouter>
        <ContainerDataModel {...props} />
      </MemoryRouter>
    );

    const rows = await screen.findAllByRole('row');

    const row1 = rows[1];

    const editDescriptionButton = await findByTestId(row1, 'edit-button');

    expect(editDescriptionButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(editDescriptionButton);
    });

    expect(await screen.findByTestId('editor-modal')).toBeInTheDocument();
  });

  it('Should not render the edit action if isReadOnly', async () => {
    render(
      <MemoryRouter>
        <ContainerDataModel
          {...props}
          isReadOnly
          hasDescriptionEditAccess={false}
        />
      </MemoryRouter>
    );

    const rows = await screen.findAllByRole('row');

    const row1 = rows[1];

    const editDescriptionButton = queryByTestId(row1, 'edit-button');

    expect(editDescriptionButton).toBeNull();
  });
});
