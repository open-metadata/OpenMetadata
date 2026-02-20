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
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  queryByTestId,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Column } from '../../../generated/entity/data/container';
import { Topic } from '../../../generated/entity/data/topic';
import { MESSAGE_SCHEMA } from '../TopicDetails/TopicDetails.mock';
import TopicSchema from './TopicSchema';
import { TopicSchemaFieldsProps } from './TopicSchema.interface';

const mockProps: TopicSchemaFieldsProps = {};

jest.mock('../../Database/TableDescription/TableDescription.component', () =>
  jest.fn().mockImplementation(({ onClick, isReadOnly }) => (
    <div data-testid="table-description">
      Table Description
      {!isReadOnly && (
        <button data-testid="edit-button" onClick={onClick}>
          Edit
        </button>
      )}
    </div>
  ))
);

jest.mock('../../../utils/TableUtils', () => {
  const actual = jest.requireActual('../../../utils/TableUtils');
  const flattenColumnsMock = (items: Column[]): Column[] => {
    if (!items || items.length === 0) {
      return [];
    }
    const result: Column[] = [];
    items.forEach((item) => {
      result.push(item);
      if (item.children && item.children.length > 0) {
        result.push(...flattenColumnsMock(item.children));
      }
    });

    return result;
  };

  return {
    ...actual,
    flattenColumns: jest.fn().mockImplementation(flattenColumnsMock),
    getTableExpandableConfig: jest.fn().mockImplementation(() => ({
      expandIcon: jest.fn(({ onExpand, expandable, record }) =>
        expandable ? (
          <button
            data-testid="expand-icon"
            onClick={(e) => onExpand(record, e)}>
            ExpandIcon
          </button>
        ) : null
      ),
    })),
    getTableColumnConfigSelections: jest
      .fn()
      .mockReturnValue(['name', 'description', 'dataType', 'tags', 'glossary']),
    handleUpdateTableColumnSelections: jest
      .fn()
      .mockReturnValue(['name', 'description', 'dataType', 'tags', 'glossary']),
  };
});

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="description-preview">Description Preview</div>
    )
);

jest.mock('../../../utils/TagsUtils', () => ({
  getAllTagsList: jest.fn().mockImplementation(() => Promise.resolve([])),
  getTagsHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../utils/GlossaryUtils', () => ({
  getGlossaryTermHierarchy: jest.fn().mockReturnValue([]),
  getGlossaryTermsList: jest.fn().mockImplementation(() => Promise.resolve([])),
}));

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

jest.mock('../../Database/SchemaEditor/SchemaEditor', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="schema-editor">SchemaEditor</div>
    ))
);

const mockOnUpdate = jest.fn();
const mockTopicDetails = {
  columns: [],
  displayName: 'test-display-name',
  description: 'test-description',
  tags: [],
  owner: 'test-owner',
  deleted: false,
  service: {
    id: 'test-service-id',
    name: 'test-service-name',
    displayName: 'test-service-display-name',
    description: 'test-service-description',
    tags: [],
    owner: 'test-owner',
  },
  messageSchema: MESSAGE_SCHEMA as Topic['messageSchema'],
};

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: mockTopicDetails,
    isVersionView: false,
    permissions: {
      EditAll: true,
    },
    onUpdate: mockOnUpdate,
    type: 'topic',
    currentVersionData: undefined,
    openColumnDetailPanel: jest.fn(),
    setDisplayedColumns: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-fqn' }),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest
    .fn()
    .mockImplementation((_entityType, fqn) => `/topic/${fqn}`),
}));

describe('Topic Schema', () => {
  it('Should render the schema component', async () => {
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    const schemaFields = await screen.findByTestId('topic-schema-fields-table');
    const rows = await screen.findAllByRole('row');

    const row1 = rows[1];

    expect(schemaFields).toBeInTheDocument();

    // should render header row and content row
    expect(rows).toHaveLength(20);

    const name = await findByText(row1, 'Order');
    const dataType = await findByText(row1, 'RECORD');
    const description = await findByText(row1, 'Table Description');
    const tagsContainer = await findAllByTestId(row1, 'table-tag-container');

    expect(name).toBeInTheDocument();
    expect(dataType).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tagsContainer).toHaveLength(2);
  });

  it('Should render the children on click of expand icon', async () => {
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    const rows = await screen.findAllByRole('row');

    const nestedRow = rows[1];
    const singleRow = rows[2];

    const expandIcon = await findByTestId(nestedRow, 'expand-icon');

    const singleRowExpandIcon = queryByTestId(singleRow, 'expand-icon');

    expect(expandIcon).toBeInTheDocument();

    // single row should not have the expand icon
    expect(singleRowExpandIcon).toBeNull();

    // order_id is child of nested row, so should be null initially
    expect(await screen.findByText('order_id')).toBeInTheDocument();

    fireEvent.click(expandIcon);

    expect(screen.queryByText('order_id')).toBeNull();
  });

  it('On edit description button click modal editor should render', async () => {
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
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
    mockTopicDetails.deleted = true;
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    const rows = await screen.findAllByRole('row');

    const row1 = rows[1];

    const editDescriptionButton = queryByTestId(row1, 'edit-button');

    expect(editDescriptionButton).toBeNull();
  });

  it('Should render copy field link button for each field', async () => {
    mockTopicDetails.deleted = false;
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    const copyButtons = await screen.findAllByTestId('copy-field-link-button');

    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it('Should copy field link to clipboard when copy button is clicked', async () => {
    mockTopicDetails.deleted = false;
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    const copyButtons = await screen.findAllByTestId('copy-field-link-button');

    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });

    expect(mockWriteText).toHaveBeenCalled();
  });
});
