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
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Column } from '../../../generated/entity/data/container';
import { Topic } from '../../../generated/entity/data/topic';
import { getTopicSchemaFieldsByFQN } from '../../../rest/topicsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { MESSAGE_SCHEMA } from '../TopicDetails/TopicDetails.mock';
import TopicSchema from './TopicSchema';
import { TopicSchemaFieldsProps } from './TopicSchema.interface';

const mockProps: TopicSchemaFieldsProps = {};

jest.mock('../../AppRouter/withSuspenseFallback', () =>
  jest.requireActual('../../AppRouter/withSuspenseFallback.tsx')
);

jest.mock('../../Database/TableDescription/TableDescription.component', () =>
  jest.fn().mockImplementation(({ onClick, isReadOnly, hasEditPermission }) => (
    <div data-testid="table-description">
      Table Description
      {!isReadOnly && hasEditPermission && (
        <button data-testid="edit-button" onClick={onClick}>
          Edit
        </button>
      )}
    </div>
  ))
);

jest.mock('../../../utils/TablePureUtils', () => {
  const actual = jest.requireActual('../../../utils/TablePureUtils');
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
  };
});

jest.mock('../../../utils/TableUtils', () => ({
  ...jest.requireActual('../../../utils/TableUtils'),
  getTableExpandableConfig: jest.fn().mockImplementation(() => ({
    expandIcon: jest.fn(({ onExpand, expandable, record }) =>
      expandable ? (
        <button data-testid="expand-icon" onClick={(e) => onExpand(record, e)}>
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
}));

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
    ModalWithMarkdownEditor: jest.fn().mockImplementation(({ onSave }) => (
      <div data-testid="editor-modal">
        <button
          data-testid="save-description"
          onClick={() => onSave('updated description').catch(() => undefined)}>
          Save
        </button>
      </div>
    )),
  })
);

jest.mock('../../Database/TableTags/TableTags.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="table-tag-container">Table Tag Container</div>
    ))
);

jest.mock('../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockImplementation(() => {
    throw new Promise(() => undefined);
  })
);

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../rest/topicsAPI', () => ({
  getTopicSchemaFieldsByFQN: jest.fn(),
}));

const mockGetTopicSchemaFields = getTopicSchemaFieldsByFQN as jest.Mock;
const SCHEMA_FIELDS = MESSAGE_SCHEMA.schemaFields;

const mockOnUpdate = jest.fn();
const mockTopicDetails = {
  fullyQualifiedName: 'sample_kafka.customer_events',
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

const defaultGenericContext = () => ({
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
});

const mockUseGenericContext = jest
  .fn()
  .mockImplementation(defaultGenericContext);

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockUseGenericContext(),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-fqn' }),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest
    .fn()
    .mockImplementation((_entityType, fqn) => `/topic/${fqn}`),
  getEntityDetailsUrl: jest
    .fn()
    .mockImplementation((_entityType, fqn) => `http://localhost/topic/${fqn}`),
}));

describe('Topic Schema', () => {
  beforeEach(() => {
    mockGetTopicSchemaFields.mockResolvedValue({
      data: SCHEMA_FIELDS,
      paging: { total: SCHEMA_FIELDS.length },
    });
  });

  afterEach(() => {
    mockUseGenericContext.mockImplementation(defaultGenericContext);
    jest.clearAllMocks();
  });

  it('fetches the first page of schema fields from the server', async () => {
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    expect(await screen.findByText('first_name')).toBeInTheDocument();
    expect(mockGetTopicSchemaFields).toHaveBeenCalledWith(
      'sample_kafka.customer_events',
      expect.objectContaining({ offset: 0, fields: 'tags', q: undefined })
    );
  });

  it('only renders the fields the server returned for the page', async () => {
    mockGetTopicSchemaFields.mockResolvedValue({
      data: [SCHEMA_FIELDS[1]],
      paging: { total: SCHEMA_FIELDS.length },
    });

    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    expect(await screen.findByText('id')).toBeInTheDocument();
    expect(screen.queryByText('first_name')).toBeNull();
  });

  it('saves a field description through the topic update', async () => {
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    await screen.findByText('first_name');
    const firstNameRow = screen
      .getAllByRole('row')
      .find((row) => row.textContent?.includes('first_name'));

    fireEvent.click(
      await findByTestId(firstNameRow as HTMLElement, 'edit-button')
    );
    const saveButton = await screen.findByTestId('save-description');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    const updatedTopic = mockOnUpdate.mock.calls[0][0] as Topic;
    const savedField = updatedTopic.messageSchema?.schemaFields?.find(
      (field) =>
        field.fullyQualifiedName === 'sample_kafka.customer_events.first_name'
    );

    expect(savedField?.description).toBe('updated description');
    expect(screen.queryByTestId('editor-modal')).toBeNull();
  });

  it('reloads the page after a saved update that keeps the same version', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    await screen.findByText('first_name');
    mockGetTopicSchemaFields.mockClear();

    // A consolidated edit returns the same version but a new messageSchema.
    mockUseGenericContext.mockReturnValue({
      ...defaultGenericContext(),
      data: {
        ...mockTopicDetails,
        messageSchema: { ...mockTopicDetails.messageSchema },
      },
    });
    rerender(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(mockGetTopicSchemaFields).toHaveBeenCalledWith(
        'sample_kafka.customer_events',
        expect.objectContaining({ offset: 0 })
      )
    );
  });

  it('restores the name sort from the URL on reload', async () => {
    render(
      <MemoryRouter initialEntries={['/topic/test-fqn?fieldSort=desc']}>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(mockGetTopicSchemaFields).toHaveBeenCalledWith(
        'sample_kafka.customer_events',
        expect.objectContaining({ offset: 0, sortOrder: 'desc' })
      )
    );
  });

  it('sorts by name on the server before paging', async () => {
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    await screen.findByText('first_name');
    mockGetTopicSchemaFields.mockClear();

    fireEvent.click(screen.getByRole('columnheader', { name: /label.name/ }));

    await waitFor(() =>
      expect(mockGetTopicSchemaFields).toHaveBeenCalledWith(
        'sample_kafka.customer_events',
        expect.objectContaining({ offset: 0, sortOrder: 'asc' })
      )
    );
  });

  it('shows an error toast and an empty table when the fetch fails', async () => {
    const error = new Error('fetch failed');
    mockGetTopicSchemaFields.mockRejectedValue(error);

    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(screen.queryByText('first_name')).toBeNull();
  });

  it('does not fetch fields in the version view', async () => {
    mockUseGenericContext.mockReturnValue({
      ...defaultGenericContext(),
      isVersionView: true,
    });

    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('topic-schema-fields-table')
    ).toBeInTheDocument();
    // Rows come from the stored messageSchema, not from a server page.
    expect(
      (await screen.findAllByTestId('table-description')).length
    ).toBeGreaterThanOrEqual(SCHEMA_FIELDS.length);
    expect(mockGetTopicSchemaFields).not.toHaveBeenCalled();
  });

  it('Should render a large skeleton while the schema editor loads', async () => {
    const { container } = render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('label.text'));
    await screen.findByTestId('entity-detail-widget-skeleton');

    expect(container.querySelectorAll('.tw\\:animate-pulse')).toHaveLength(5);
  });

  it('Should render the schema component', async () => {
    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    const schemaFields = await screen.findByTestId('topic-schema-fields-table');
    await screen.findByText('first_name');
    const rows = screen.getAllByRole('row');

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

    await screen.findByText('first_name');
    const rows = screen.getAllByRole('row');

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

    await screen.findByText('first_name');
    const rows = screen.getAllByRole('row');

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

    await screen.findByText('first_name');
    const rows = screen.getAllByRole('row');

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

  // Explicit-deny-wins fix (Task 8): the old `permissions.EditAll ||
  // permissions.EditDescription` raw OR would have returned true here (EditAll
  // granted). getDerivedPermissionFlags prioritizes the field-specific key —
  // EditDescription explicitly false wins over EditAll.
  it('prioritizes an explicit field-level deny over a granted EditAll', async () => {
    mockTopicDetails.deleted = false;
    mockUseGenericContext.mockReturnValue({
      data: mockTopicDetails,
      isVersionView: false,
      permissions: {
        EditAll: true,
        EditDescription: false,
      },
      onUpdate: mockOnUpdate,
      type: 'topic',
      currentVersionData: undefined,
      openColumnDetailPanel: jest.fn(),
      setDisplayedColumns: jest.fn(),
    });

    render(
      <MemoryRouter>
        <TopicSchema {...mockProps} />
      </MemoryRouter>
    );

    await screen.findByText('first_name');
    const rows = screen.getAllByRole('row');
    const row1 = rows[1];

    expect(queryByTestId(row1, 'edit-button')).toBeNull();
  });
});
