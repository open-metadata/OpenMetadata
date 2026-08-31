/*
 *  Copyright 2025 Collate.
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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { File } from '../../../../generated/entity/data/file';
import {
  Column,
  Constraint,
  DataType,
  TagSource,
} from '../../../../generated/entity/data/table';
import { LabelType, State } from '../../../../generated/type/tagLabel';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import FileColumnsTable from './FileColumnsTable';

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.displayName || entity?.name),
}));
jest.mock('../../../../utils/TableTags/TableTags.utils', () => ({
  getAllTags: jest.fn(() => []),
  getFilteredTagsData: jest.fn((data) => data),
}));
jest.mock('../../../../utils/TablePureUtils', () => ({
  ...jest.requireActual('../../../../utils/TablePureUtils'),
  pruneEmptyChildren: jest.fn().mockImplementation((columns) => columns),
  updateFieldDescription: jest.fn(),
  updateFieldTags: jest.fn(),
}));

jest.mock('../../../../utils/TableUtils', () => ({
  ...jest.requireActual('../../../../utils/TableUtils'),
  prepareConstraintIcon: jest.fn(() => null),
  getTableExpandableConfig: jest.fn(() => ({})),
}));
jest.mock(
  '../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    EntityAttachmentProvider: jest.fn(({ children }) => (
      <div data-testid="entity-attachment-provider">{children}</div>
    )),
  })
);
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div data-testid="error-placeholder">No columns available</div>)
);
jest.mock('../../../common/Table/Table', () =>
  jest.fn(({ columns, dataSource, expandable }) => (
    <div data-testid="file-columns-table">
      <div data-testid="table-columns-count">{columns?.length || 0}</div>
      <div data-testid="table-expandable">
        {expandable ? 'expandable' : 'not-expandable'}
      </div>
      {dataSource.map((column: Column, index: number) => (
        <div data-testid={`column-row-${index}`} key={column.name || index}>
          <div data-testid="column-name">{column.name}</div>
          {column.displayName && (
            <div data-testid="column-display-name">{column.displayName}</div>
          )}
          <div data-testid="column-type">{column.dataType}</div>
          {column.description && (
            <div data-testid="column-description">{column.description}</div>
          )}
        </div>
      ))}
    </div>
  ))
);
const mockUseGenericContextResult = {
  data: null as File | null,
  permissions: {} as OperationPermission,
  onUpdate: jest.fn(),
};

jest.mock('../../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));
jest.mock('../../../Database/ColumnFilter/ColumnFilter.component', () => ({
  ColumnFilter: jest.fn(() => <div data-testid="column-filter">Filter</div>),
}));
jest.mock('../../../Database/TableDescription/TableDescription.component', () =>
  jest.fn(({ columnData, onClick }) => (
    <div
      data-testid="table-description"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onClick}>
      {columnData.field || 'No description'}
    </div>
  ))
);
jest.mock('../../../Database/TableTags/TableTags.component', () =>
  jest.fn(({ record, tags, type }) => (
    <div data-testid={`table-tags-${type.toLowerCase()}`}>
      <div data-testid="record-name">{record?.name || 'unknown'}</div>
      {tags?.length ? `${tags.length} tags` : 'No tags'}
    </div>
  ))
);
jest.mock(
  '../../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest.fn(
      ({ visible, header, value, onSave, onCancel }) =>
        visible ? (
          <div data-testid="modal-with-markdown-editor">
            <h3>{header}</h3>
            <textarea
              aria-label="Description"
              data-testid="description-input"
              defaultValue={value}
            />
            <button
              data-testid="save-button"
              onClick={() => onSave('Updated description')}>
              Save
            </button>
            <button data-testid="cancel-button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        ) : null
    ),
  })
);

const mockColumns: Column[] = [
  {
    name: 'id',
    fullyQualifiedName: 'test-drive-service.test-file.id',
    displayName: 'ID Column',
    dataType: DataType.Int,
    dataTypeDisplay: 'integer',
    description: 'Unique identifier column',
    constraint: Constraint.PrimaryKey,
    tags: [
      {
        tagFQN: 'PII.NonPII',
        description: 'Non-PII tag',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
  },
  {
    name: 'name',
    fullyQualifiedName: 'test-drive-service.test-file.name',
    displayName: 'Name Column',
    dataType: DataType.String,
    dataTypeDisplay: 'varchar(255)',
    description: 'Name field with personal information',
    tags: [
      {
        tagFQN: 'PII.Sensitive',
        description: 'PII Sensitive tag',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'PersonalData.Personal',
        description: 'Personal data glossary term',
        source: TagSource.Glossary,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
  },
];

const mockFileDetails: File = {
  id: 'file-id-1',
  name: 'test-file',
  displayName: 'Test File',
  fullyQualifiedName: 'test-drive-service.test-file',
  description: 'Test file description',
  columns: mockColumns,
  service: {
    id: 'service-1',
    type: 'driveService',
    name: 'test-drive-service',
    fullyQualifiedName: 'test-drive-service',
    displayName: 'Test Drive Service',
    deleted: false,
  },
  version: 1.0,
  updatedAt: 1640995200000,
  updatedBy: 'test-user',
  deleted: false,
  href: 'http://localhost:8585/api/v1/files/file-id-1',
};

const renderFileColumnsTable = (
  fileData: Partial<File> = {},
  permissions: Partial<OperationPermission> = {}
) => {
  const finalFileData = { ...mockFileDetails, ...fileData };
  const finalPermissions = { ...ENTITY_PERMISSIONS, ...permissions };

  mockUseGenericContextResult.data = finalFileData;
  mockUseGenericContextResult.permissions = finalPermissions;

  return render(
    <MemoryRouter>
      <FileColumnsTable />
    </MemoryRouter>
  );
};

describe('FileColumnsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGenericContextResult.data = mockFileDetails;
    mockUseGenericContextResult.permissions = ENTITY_PERMISSIONS;
    mockUseGenericContextResult.onUpdate = jest.fn();
  });

  it('should render file columns table successfully', () => {
    renderFileColumnsTable();

    expect(screen.getByTestId('file-columns-table')).toBeInTheDocument();
  });

  it('should display columns data correctly', () => {
    renderFileColumnsTable();

    expect(screen.getByTestId('column-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('column-row-1')).toBeInTheDocument();

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('should display column display names when available', () => {
    renderFileColumnsTable();

    expect(screen.getByText('ID Column')).toBeInTheDocument();
    expect(screen.getByText('Name Column')).toBeInTheDocument();
  });

  it('should display column data types', () => {
    renderFileColumnsTable();

    expect(screen.getByText('INT')).toBeInTheDocument();
    expect(screen.getByText('STRING')).toBeInTheDocument();
  });

  it('should display column descriptions', () => {
    renderFileColumnsTable();

    expect(screen.getByText('Unique identifier column')).toBeInTheDocument();
    expect(
      screen.getByText('Name field with personal information')
    ).toBeInTheDocument();
  });

  it('should render error placeholder when no columns available', () => {
    renderFileColumnsTable({ columns: [] });

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('should render error placeholder when columns is undefined', () => {
    renderFileColumnsTable({ columns: undefined });

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('should disable editing when file is deleted', () => {
    renderFileColumnsTable({ deleted: true });

    expect(screen.getByTestId('file-columns-table')).toBeInTheDocument();
  });

  it('should handle limited edit permissions', () => {
    renderFileColumnsTable(
      {},
      {
        EditAll: false,
        EditDescription: false,
        EditTags: false,
        EditGlossaryTerms: false,
      }
    );

    expect(screen.getByTestId('file-columns-table')).toBeInTheDocument();
  });

  it('should handle columns without display names', () => {
    const columnsWithoutDisplayName = mockColumns.map((col) => ({
      ...col,
      displayName: undefined,
    }));

    renderFileColumnsTable({ columns: columnsWithoutDisplayName });

    expect(screen.getByTestId('file-columns-table')).toBeInTheDocument();
  });

  it('should handle columns without tags', () => {
    const columnsWithoutTags = mockColumns.map((col) => ({
      ...col,
      tags: [],
    }));

    renderFileColumnsTable({ columns: columnsWithoutTags });

    expect(screen.getByTestId('file-columns-table')).toBeInTheDocument();
  });

  it('should handle file without fullyQualifiedName', () => {
    renderFileColumnsTable({ fullyQualifiedName: undefined });

    expect(screen.getByTestId('file-columns-table')).toBeInTheDocument();
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 4):
  // an explicit per-field deny must win over a bare EditAll grant (explicit-deny-wins,
  // Task 6 Finding 1) — the old raw `(EditAll || EditX) && !deleted` OR let EditAll grant
  // unconditionally. Read the `columns` prop the component actually passed to the mocked
  // <Table> and invoke each column's `render` directly to inspect the permission prop it
  // wires into TableDescription/TableTags, rather than reworking the Table mock (which
  // renders dataSource directly, bypassing antd-style column render callbacks).
  const MockedTable = jest.requireMock('../../../common/Table/Table');
  const getRenderedProps = (columnKey: string, columnData: Column) => {
    const { columns } = MockedTable.mock.calls[
      MockedTable.mock.calls.length - 1
    ][0];
    const column = columns.find((c: { key: string }) => c.key === columnKey);

    return column.render(columnData.tags, columnData, 0).props;
  };

  it('denies description edit when EditDescription is explicitly false, even with EditAll true', () => {
    renderFileColumnsTable({}, { EditAll: true, EditDescription: false });

    expect(
      getRenderedProps('description', mockColumns[0]).hasEditPermission
    ).toBe(false);
  });

  it('denies tags edit when EditTags is explicitly false, even with EditAll true', () => {
    renderFileColumnsTable({}, { EditAll: true, EditTags: false });

    expect(getRenderedProps('tags', mockColumns[0]).hasTagEditAccess).toBe(
      false
    );
  });

  it('denies glossary term edit when EditGlossaryTerms is explicitly false, even with EditAll true', () => {
    renderFileColumnsTable({}, { EditAll: true, EditGlossaryTerms: false });

    expect(
      getRenderedProps('glossary', mockColumns[0]).hasTagEditAccess
    ).toBe(false);
  });

  it('grants description/tags/glossary edit when only EditAll is true', () => {
    renderFileColumnsTable({}, { EditAll: true });

    expect(
      getRenderedProps('description', mockColumns[0]).hasEditPermission
    ).toBe(true);
    expect(getRenderedProps('tags', mockColumns[0]).hasTagEditAccess).toBe(
      true
    );
    expect(
      getRenderedProps('glossary', mockColumns[0]).hasTagEditAccess
    ).toBe(true);
  });

  it('denies edit for all three fields when the file is deleted, even with EditAll true', () => {
    renderFileColumnsTable({ deleted: true }, { EditAll: true });

    expect(
      getRenderedProps('description', mockColumns[0]).hasEditPermission
    ).toBe(false);
    expect(getRenderedProps('tags', mockColumns[0]).hasTagEditAccess).toBe(
      false
    );
    expect(
      getRenderedProps('glossary', mockColumns[0]).hasTagEditAccess
    ).toBe(false);
  });
});
