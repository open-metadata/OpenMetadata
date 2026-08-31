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
import { render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  APIEndpoint,
  DataTypeTopic,
  Field,
} from '../../../generated/entity/data/apiEndpoint';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import APIEndpointSchema from './APIEndpointSchema';

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.displayName || entity?.name),
}));
jest.mock('../../../utils/TableTags/TableTags.utils', () => ({
  getAllTags: jest.fn(() => []),
}));
jest.mock('../../../utils/EntitySortUtils', () => ({
  getColumnSorter: jest.fn(() => undefined),
}));
jest.mock('../../../utils/TableColumn.util', () => ({
  columnFilterIcon: jest.fn(() => null),
}));
jest.mock('../../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn(() => ({})),
}));
jest.mock('../../../utils/SchemaVersionUtils', () => ({
  getVersionedSchema: jest.fn((schema) => schema),
}));
jest.mock('../../../utils/TablePureUtils', () => ({
  fieldExistsByFQN: jest.fn(() => false),
  getAllRowKeysByKeyName: jest.fn(() => []),
  getHighlightedRowClassName: jest.fn(() => ''),
  updateFieldDescription: jest.fn(),
  updateFieldTags: jest.fn(),
}));
jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({ theme: {} })),
}));
jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ columnFqn: '', fqn: '' })),
}));
jest.mock('../../../hooks/useFqnDeepLink', () => ({
  useFqnDeepLink: jest.fn(),
}));
jest.mock('../../../hooks/useScrollToElement', () => ({
  useScrollToElement: jest.fn(),
}));
jest.mock('../../../hooks/useTreeTagFilter', () => ({
  useTreeTagFilter: jest.fn((data) => ({
    tagFilterState: {},
    filteredData: data,
    handleTableChange: jest.fn(),
  })),
}));
jest.mock(
  '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    EntityAttachmentProvider: jest.fn(({ children }) => (
      <div data-testid="entity-attachment-provider">{children}</div>
    )),
  })
);
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn(() => <div>RichTextEditorPreviewer</div>)
);
jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest.fn(() => (
      <div data-testid="modal-with-markdown-editor" />
    )),
  })
);
jest.mock('../../Database/ColumnFilter/ColumnFilter.component', () => ({
  ColumnFilter: jest.fn(() => <div data-testid="column-filter">Filter</div>),
}));
jest.mock('../../Database/TableDescription/TableDescription.component', () =>
  jest.fn(({ hasEditPermission }) => (
    <div data-testid="table-description">
      {hasEditPermission ? 'editable' : 'readonly'}
    </div>
  ))
);
jest.mock('../../Database/TableTags/TableTags.component', () =>
  jest.fn(({ hasTagEditAccess, type }) => (
    <div data-testid={`table-tags-${type.toLowerCase()}`}>
      {hasTagEditAccess ? 'editable' : 'readonly'}
    </div>
  ))
);
jest.mock('../../common/CopyLinkButton/CopyLinkButton', () =>
  jest.fn(() => <div data-testid="copy-link-button" />)
);
jest.mock('../../common/ToggleExpandButton/ToggleExpandButton', () =>
  jest.fn(() => <div data-testid="toggle-expand-button" />)
);
jest.mock('../../common/Table/Table', () =>
  jest.fn(({ columns, dataSource }) => (
    <div data-testid="schema-fields-table">
      <div data-testid="table-rows-count">{dataSource?.length ?? 0}</div>
      {dataSource?.map((field: Field) => (
        <div data-testid={`field-row-${field.name}`} key={field.name} />
      ))}
      <div data-testid="table-columns-count">{columns?.length ?? 0}</div>
    </div>
  ))
);

const mockUseGenericContextResult = {
  data: null as APIEndpoint | null,
  permissions: {} as OperationPermission,
  onUpdate: jest.fn(),
  openColumnDetailPanel: jest.fn(),
  selectedColumn: null,
  setDisplayedColumns: jest.fn(),
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));

const mockFields: Field[] = [
  {
    name: 'id',
    fullyQualifiedName: 'svc.api-collection.endpoint.requestSchema.id',
    dataType: DataTypeTopic.Int,
    description: 'Identifier field',
    tags: [],
  },
  {
    name: 'name',
    fullyQualifiedName: 'svc.api-collection.endpoint.requestSchema.name',
    dataType: DataTypeTopic.String,
    description: 'Name field',
    tags: [],
  },
];

const mockApiEndpointDetails: APIEndpoint = {
  id: 'api-endpoint-id-1',
  name: 'test-endpoint',
  fullyQualifiedName: 'svc.api-collection.endpoint',
  requestSchema: {
    schemaType: 'JSON',
    schemaFields: mockFields,
  },
  responseSchema: {
    schemaType: 'JSON',
    schemaFields: [],
  },
  service: {
    id: 'service-1',
    type: 'apiService',
    name: 'svc',
  },
  deleted: false,
} as unknown as APIEndpoint;

const renderApiEndpointSchema = (
  apiEndpointOverrides: Partial<APIEndpoint> = {},
  permissions: Partial<OperationPermission> = {}
) => {
  mockUseGenericContextResult.data = {
    ...mockApiEndpointDetails,
    ...apiEndpointOverrides,
  };
  mockUseGenericContextResult.permissions = {
    ...ENTITY_PERMISSIONS,
    ...permissions,
  };

  return render(<APIEndpointSchema />);
};

describe('APIEndpointSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGenericContextResult.data = mockApiEndpointDetails;
    mockUseGenericContextResult.permissions = ENTITY_PERMISSIONS;
  });

  it('should render the schema fields table', () => {
    renderApiEndpointSchema();

    expect(screen.getByTestId('schema-fields-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-rows-count')).toHaveTextContent('2');
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 7): an
  // explicit per-field deny must win over a bare EditAll grant (explicit-deny-wins, Task 6
  // Finding 1) — the old raw `EditX || EditAll` OR let EditAll grant unconditionally. Rather
  // than reworking the Table mock (which renders dataSource directly, bypassing antd-style
  // column `render` callbacks), read the `columns` prop the component actually passed to
  // <Table> and invoke each column's `render` directly to inspect the permission prop it
  // wires into TableDescription/TableTags (WorksheetColumnsTable.test.tsx precedent).
  const MockedTable = jest.requireMock('../../common/Table/Table');
  const getRenderedProps = (columnKey: string, field: Field) => {
    const { columns } = MockedTable.mock.calls[
      MockedTable.mock.calls.length - 1
    ][0];
    const column = columns.find((c: { key: string }) => c.key === columnKey);

    return column.render(field.tags, field, 0).props;
  };

  it('denies description edit when EditDescription is explicitly false, even with EditAll true', () => {
    renderApiEndpointSchema({}, { EditAll: true, EditDescription: false });

    expect(
      getRenderedProps('description', mockFields[0]).hasEditPermission
    ).toBe(false);
  });

  it('grants description edit via EditAll when EditDescription is not present', () => {
    // Deliberately NOT merged with ENTITY_PERMISSIONS: that fixture defines every Operation
    // key (including EditDescription), which would make getPrioritizedEditPermission's
    // "key present" check see EditDescription as an explicit `false`/`undefined` deny rather
    // than truly absent, masking the EditAll fallback this test exists to cover
    // (SchemaTable.test.tsx precedent).
    mockUseGenericContextResult.data = mockApiEndpointDetails;
    mockUseGenericContextResult.permissions = {
      EditAll: true,
    } as OperationPermission;

    render(<APIEndpointSchema />);

    expect(
      getRenderedProps('description', mockFields[0]).hasEditPermission
    ).toBe(true);
  });

  it('denies tags edit when EditTags is explicitly false, even with EditAll true', () => {
    renderApiEndpointSchema({}, { EditAll: true, EditTags: false });

    expect(
      getRenderedProps('tags', mockFields[0]).hasTagEditAccess
    ).toBe(false);
  });

  it('denies glossary term edit when EditGlossaryTerms is explicitly false, even with EditAll true', () => {
    renderApiEndpointSchema(
      {},
      { EditAll: true, EditGlossaryTerms: false }
    );

    expect(
      getRenderedProps('glossary', mockFields[0]).hasTagEditAccess
    ).toBe(false);
  });
});
