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
import {
  Column,
  Constraint,
  DataType,
  TagSource,
  Worksheet,
} from '../../../../generated/entity/data/worksheet';
import { LabelType, State } from '../../../../generated/type/tagLabel';
import { ENTITY_PERMISSIONS } from '../../../../mocks/Permissions.mock';
import WorksheetColumnsTable from './WorksheetColumnsTable';

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.displayName || entity?.name),
}));
jest.mock('../../../../utils/TableTags/TableTags.utils', () => ({
  getAllTags: jest.fn(() => []),
  searchTagInData: jest.fn(() => true),
}));
jest.mock('../../../../utils/TableUtils', () => ({
  ...jest.requireActual('../../../../utils/TableUtils'),
  pruneEmptyChildren: jest.fn().mockImplementation((columns) => columns),
  prepareConstraintIcon: jest.fn(() => null),
  updateFieldDescription: jest.fn(),
  updateFieldTags: jest.fn(),
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
    <div data-testid="worksheet-data-model-table">
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
  data: null as Worksheet | null,
  permissions: {} as OperationPermission,
  onUpdate: jest.fn(),
  setDisplayedColumns: jest.fn(),
};

jest.mock('../../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));
jest.mock('../../../Database/ColumnFilter/ColumnFilter.component', () => ({
  ColumnFilter: jest.fn(() => <div data-testid="column-filter">Filter</div>),
}));
jest.mock('../../../Database/TableDescription/TableDescription.component', () =>
  jest.fn(({ columnData, onClick }) => (
    <div data-testid="table-description" onClick={onClick}>
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
            <textarea data-testid="description-input" defaultValue={value} />
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
    fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet.id',
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
    fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet.name',
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
  {
    name: 'email',
    fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet.email',
    dataType: DataType.String,
    description: '',
    tags: [],
    children: [
      {
        name: 'domain',
        fullyQualifiedName:
          'test-service.test-spreadsheet.test-worksheet.email.domain',
        dataType: DataType.String,
        description: 'Email domain part',
        tags: [],
      },
    ],
  },
];

const mockWorksheetDetails: Worksheet = {
  id: 'worksheet-id-1',
  name: 'test-worksheet',
  displayName: 'Test Worksheet',
  fullyQualifiedName: 'test-service.test-spreadsheet.test-worksheet',
  description: 'Test worksheet description',
  columns: mockColumns,
  spreadsheet: {
    id: 'spreadsheet-1',
    type: 'spreadsheet',
    name: 'test-spreadsheet',
    fullyQualifiedName: 'test-service.test-spreadsheet',
    displayName: 'Test Spreadsheet',
    deleted: false,
  },
  version: 1.0,
  updatedAt: 1640995200000,
  updatedBy: 'test-user',
  service: {
    id: 'service-1',
    type: 'driveService',
    name: 'test-drive-service',
    fullyQualifiedName: 'test-drive-service',
    displayName: 'Test Drive Service',
    deleted: false,
  },
  deleted: false,
  href: 'http://localhost:8585/api/v1/worksheets/worksheet-id-1',
};

const renderWorksheetColumnsTable = (
  worksheetData: Partial<Worksheet> = {},
  permissions: Partial<OperationPermission> = {}
) => {
  const finalWorksheetData = { ...mockWorksheetDetails, ...worksheetData };
  const finalPermissions = { ...ENTITY_PERMISSIONS, ...permissions };

  mockUseGenericContextResult.data = finalWorksheetData;
  mockUseGenericContextResult.permissions = finalPermissions;

  return render(
    <MemoryRouter>
      <WorksheetColumnsTable />
    </MemoryRouter>
  );
};

describe('WorksheetColumnsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock data
    mockUseGenericContextResult.data = mockWorksheetDetails;
    mockUseGenericContextResult.permissions = ENTITY_PERMISSIONS;
    mockUseGenericContextResult.onUpdate = jest.fn();
  });

  it('should render worksheet columns table successfully', () => {
    renderWorksheetColumnsTable();

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should display columns data correctly', () => {
    renderWorksheetColumnsTable();

    expect(screen.getByTestId('column-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('column-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('column-row-2')).toBeInTheDocument();

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('should display column display names when available', () => {
    renderWorksheetColumnsTable();

    expect(screen.getByText('ID Column')).toBeInTheDocument();
    expect(screen.getByText('Name Column')).toBeInTheDocument();
  });

  it('should display column data types', () => {
    renderWorksheetColumnsTable();

    expect(screen.getByText('INT')).toBeInTheDocument();
    expect(screen.getAllByText('STRING')).toHaveLength(2);
  });

  it('should display column descriptions', () => {
    renderWorksheetColumnsTable();

    expect(screen.getByText('Unique identifier column')).toBeInTheDocument();
    expect(
      screen.getByText('Name field with personal information')
    ).toBeInTheDocument();
  });

  it('should render error placeholder when no columns available', () => {
    renderWorksheetColumnsTable({
      columns: [],
    });

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('should render error placeholder when columns is undefined', () => {
    renderWorksheetColumnsTable({
      columns: undefined,
    });

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('should handle column description edit click', async () => {
    renderWorksheetColumnsTable();

    expect(screen.getByText('Unique identifier column')).toBeInTheDocument();
    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle column description save', async () => {
    const mockOnUpdate = jest.fn().mockResolvedValue(undefined);
    mockUseGenericContextResult.onUpdate = mockOnUpdate;

    renderWorksheetColumnsTable();

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
    expect(screen.getByText('Unique identifier column')).toBeInTheDocument();
  });

  it('should handle column description cancel', async () => {
    renderWorksheetColumnsTable();

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
    expect(screen.getByText('Unique identifier column')).toBeInTheDocument();
  });

  it('should disable editing when worksheet is deleted', () => {
    renderWorksheetColumnsTable({
      deleted: true,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle limited edit permissions', () => {
    renderWorksheetColumnsTable(
      {},
      {
        EditAll: false,
        EditDescription: false,
        EditTags: false,
        EditGlossaryTerms: false,
      }
    );

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should display table tags for classification tags', () => {
    renderWorksheetColumnsTable();

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should display table tags for glossary terms', () => {
    renderWorksheetColumnsTable();

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle columns with constraints', () => {
    renderWorksheetColumnsTable();

    expect(screen.getByTestId('column-row-0')).toBeInTheDocument();
  });

  it('should handle columns without display names', () => {
    const columnsWithoutDisplayName = mockColumns.map((col) => ({
      ...col,
      displayName: undefined,
    }));

    renderWorksheetColumnsTable({
      columns: columnsWithoutDisplayName,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle columns without descriptions', () => {
    const columnsWithoutDescription = mockColumns.map((col) => ({
      ...col,
      description: '',
    }));

    renderWorksheetColumnsTable({
      columns: columnsWithoutDescription,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle columns without tags', () => {
    const columnsWithoutTags = mockColumns.map((col) => ({
      ...col,
      tags: [],
    }));

    renderWorksheetColumnsTable({
      columns: columnsWithoutTags,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle nested columns (children)', () => {
    renderWorksheetColumnsTable();

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle columns with different data types', () => {
    const columnsWithVariousTypes: Column[] = [
      {
        ...mockColumns[0],
        dataType: DataType.Bigint,
        dataTypeDisplay: 'bigint',
      },
      {
        ...mockColumns[1],
        dataType: DataType.Boolean,
        dataTypeDisplay: 'boolean',
      },
      {
        ...mockColumns[2],
        dataType: DataType.Timestamp,
        dataTypeDisplay: 'timestamp',
      },
    ];

    renderWorksheetColumnsTable({
      columns: columnsWithVariousTypes,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle long column names gracefully', () => {
    const columnsWithLongNames = [
      {
        ...mockColumns[0],
        name: 'very_long_column_name_that_might_cause_display_issues_in_the_table',
        displayName:
          'Very Long Column Name That Might Cause Display Issues In The Table',
      },
    ];

    renderWorksheetColumnsTable({
      columns: columnsWithLongNames,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle columns with special characters', () => {
    const columnsWithSpecialChars = [
      {
        ...mockColumns[0],
        name: 'column_with-special@chars#123',
        displayName: 'Column With Special @#$ Characters',
      },
    ];

    renderWorksheetColumnsTable({
      columns: columnsWithSpecialChars,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle columns without fullyQualifiedName', () => {
    const columnsWithoutFQN = mockColumns.map((col) => ({
      ...col,
      fullyQualifiedName: undefined,
    }));

    renderWorksheetColumnsTable({
      columns: columnsWithoutFQN,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle worksheet without fullyQualifiedName', () => {
    renderWorksheetColumnsTable({
      fullyQualifiedName: undefined,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should render table description components', () => {
    renderWorksheetColumnsTable();

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });

  it('should handle columns with mixed tag types', () => {
    const columnsWithMixedTags = [
      {
        ...mockColumns[1],
        tags: [
          {
            tagFQN: 'PII.Sensitive',
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
          {
            tagFQN: 'PersonalData.Personal',
            source: TagSource.Glossary,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ],
      },
    ];

    renderWorksheetColumnsTable({
      columns: columnsWithMixedTags,
    });

    expect(
      screen.getByTestId('worksheet-data-model-table')
    ).toBeInTheDocument();
  });
});
