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
import { Pipeline, Task } from '../../../generated/entity/data/pipeline';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { PipelineTaskTab } from './PipelineTaskTab';

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
  ownerTableObject: jest.fn(() => []),
}));
jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    currentPage: 1,
    pageSize: 10,
    showPagination: false,
    paging: {},
    handlePagingChange: jest.fn(),
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  })),
}));
jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    entityFqn: 'svc.pipeline',
    columnFqn: '',
    fqn: '',
  })),
}));
jest.mock('../../../hooks/useFqnDeepLink', () => ({
  useFqnDeepLink: jest.fn(),
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
    <div data-testid={`table-tags-${String(type).toLowerCase()}`}>
      {hasTagEditAccess ? 'editable' : 'readonly'}
    </div>
  ))
);
jest.mock('../../common/Table/Table', () =>
  jest.fn(({ columns, dataSource }) => (
    <div data-testid="task-table">
      <div data-testid="table-rows-count">{dataSource?.length ?? 0}</div>
      <div data-testid="table-columns-count">{columns?.length ?? 0}</div>
    </div>
  ))
);

const mockUseGenericContextResult = {
  data: null as unknown as Pipeline,
  permissions: {} as OperationPermission,
  onUpdate: jest.fn(),
  openColumnDetailPanel: jest.fn(),
  selectedColumn: null,
  setDisplayedColumns: jest.fn(),
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));

const mockTasks: Task[] = [
  {
    name: 'extract',
    fullyQualifiedName: 'svc.pipeline.extract',
    description: 'Extract task',
    tags: [],
  },
  {
    name: 'load',
    fullyQualifiedName: 'svc.pipeline.load',
    description: 'Load task',
    tags: [],
  },
];

const mockPipelineDetails: Pipeline = {
  id: 'pipeline-id-1',
  name: 'test-pipeline',
  fullyQualifiedName: 'svc.pipeline',
  tasks: mockTasks,
  service: {
    id: 'service-1',
    type: 'pipelineService',
    name: 'svc',
  },
  deleted: false,
} as unknown as Pipeline;

const renderPipelineTaskTab = (
  pipelineOverrides: Partial<Pipeline> = {},
  permissions: Partial<OperationPermission> = {}
) => {
  mockUseGenericContextResult.data = {
    ...mockPipelineDetails,
    ...pipelineOverrides,
  };
  mockUseGenericContextResult.permissions = {
    ...ENTITY_PERMISSIONS,
    ...permissions,
  };

  return render(<PipelineTaskTab />);
};

describe('PipelineTaskTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGenericContextResult.data = mockPipelineDetails;
    mockUseGenericContextResult.permissions = ENTITY_PERMISSIONS;
  });

  it('should render the task table', () => {
    renderPipelineTaskTab();

    expect(screen.getByTestId('task-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-rows-count')).toHaveTextContent('2');
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 9): an
  // explicit per-field deny must win over a bare EditAll grant (explicit-deny-wins) — the
  // old raw `EditAll || EditX` OR let EditAll grant unconditionally. The Table mock renders
  // dataSource directly rather than invoking antd-style column `render` callbacks, so read
  // the `columns` prop the component actually passed to <Table> and invoke each column's
  // `render` directly (APIEndpointSchema.test.tsx / WorksheetColumnsTable.test.tsx
  // precedent).
  const MockedTable = jest.requireMock('../../common/Table/Table');
  const getRenderedProps = (columnKey: string, task: Task) => {
    const { columns } =
      MockedTable.mock.calls[MockedTable.mock.calls.length - 1][0];
    const column = columns.find((c: { key: string }) => c.key === columnKey);

    return column.render(task.tags, task, 0).props;
  };

  it('denies description edit when EditDescription is explicitly false, even with EditAll true', () => {
    renderPipelineTaskTab({}, { EditAll: true, EditDescription: false });

    expect(
      getRenderedProps('description', mockTasks[0]).hasEditPermission
    ).toBe(false);
  });

  it('grants description edit via EditAll when EditDescription is not present', () => {
    // Deliberately NOT merged with ENTITY_PERMISSIONS: that fixture defines every Operation
    // key (including EditDescription), which would make getPrioritizedEditPermission's
    // "key present" check see EditDescription as an explicit deny rather than truly absent,
    // masking the EditAll fallback this test exists to cover (SchemaTable.test.tsx
    // precedent).
    mockUseGenericContextResult.data = mockPipelineDetails;
    mockUseGenericContextResult.permissions = {
      EditAll: true,
    } as OperationPermission;

    render(<PipelineTaskTab />);

    expect(
      getRenderedProps('description', mockTasks[0]).hasEditPermission
    ).toBe(true);
  });

  it('denies tags edit when EditTags is explicitly false, even with EditAll true', () => {
    renderPipelineTaskTab({}, { EditAll: true, EditTags: false });

    expect(getRenderedProps('tags', mockTasks[0]).hasTagEditAccess).toBe(false);
  });

  it('denies glossary term edit when EditGlossaryTerms is explicitly false, even with EditAll true', () => {
    renderPipelineTaskTab({}, { EditAll: true, EditGlossaryTerms: false });

    expect(getRenderedProps('glossary', mockTasks[0]).hasTagEditAccess).toBe(
      false
    );
  });
});
