/*
 *  Copyright 2024 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ProviderType } from '../../../generated/entity/bot';
import {
  deleteTestDefinitionByFqn,
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import TestDefinitionForm from '../TestDefinitionForm/TestDefinitionForm.component';
import TestDefinitionList from './TestDefinitionList.component';

const mockTestDefinitions = {
  data: [
    {
      id: 'test-def-1',
      name: 'columnValuesToBeNotNull',
      fullyQualifiedName: 'columnValuesToBeNotNull',
      displayName: 'Column Values To Be Not Null',
      description: 'Ensures that all values in a column are not null',
      entityType: 'COLUMN',
      testPlatforms: ['OpenMetadata'],
      enabled: true,
      provider: ProviderType.User,
    },
    {
      id: 'test-def-2',
      name: 'tableRowCountToBeBetween',
      fullyQualifiedName: 'tableRowCountToBeBetween',
      displayName: 'Table Row Count To Be Between',
      description: 'Ensures table row count is between min and max values',
      entityType: 'TABLE',
      testPlatforms: ['OpenMetadata', 'DBT'],
      enabled: false,
      provider: ProviderType.System,
    },
    {
      id: 'test-def-3',
      name: 'dbtSchemaTest',
      fullyQualifiedName: 'dbtSchemaTest',
      displayName: 'DBT Schema Test',
      description: 'External test managed by DBT',
      entityType: 'TABLE',
      testPlatforms: ['dbt'],
      enabled: true,
      provider: ProviderType.User,
    },
    {
      id: 'test-def-4',
      name: 'greatExpectationsTest',
      fullyQualifiedName: 'greatExpectationsTest',
      displayName: 'Great Expectations Test',
      description: 'External test managed by Great Expectations',
      entityType: 'COLUMN',
      testPlatforms: ['GreatExpectations'],
      enabled: false,
      provider: ProviderType.User,
    },
  ],
  paging: {
    total: 4,
  },
};

jest.mock('../../../rest/testAPI', () => ({
  getListTestDefinitions: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTestDefinitions)),
  patchTestDefinition: jest.fn().mockImplementation(() => Promise.resolve({})),
  deleteTestDefinitionByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../TestDefinitionForm/TestDefinitionForm.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="test-definition-form">TestDefinitionForm</div>
    )),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout">{children}</div>
    )),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    pageSize: 15,
    paging: { total: 2 },
    handlePagingChange: jest.fn(),
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: false,
    pagingCursor: {
      cursorType: undefined,
      cursorValue: undefined,
      currentPage: '1',
      pageSize: 15,
    },
  }),
}));

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockReturnValue({
    filters: {
      entityType: undefined,
      testPlatforms: undefined,
    },
    setFilters: jest.fn(),
  }),
}));

jest.mock('../../common/atoms/filters/useQuickFiltersWithComponent', () => ({
  ...jest.requireActual(
    '../../common/atoms/filters/useQuickFiltersWithComponent'
  ),
  useQuickFiltersWithComponent: jest.fn().mockReturnValue({
    quickFilters: <div data-testid="quick-filters">Quick Filters</div>,
  }),
}));

jest.mock('../../common/atoms/filters/useFilterSelection', () => ({
  useFilterSelection: jest.fn().mockReturnValue({
    filterSelectionDisplay: null,
  }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      ViewBasic: true,
      EditAll: true,
    }),
    permissions: {
      testDefinition: {
        Create: true,
        Delete: true,
        ViewAll: true,
        ViewBasic: true,
        EditAll: true,
      },
    },
  }),
}));

jest.mock('../../Modals/EntityDeleteModal/EntityDeleteModal', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ visible, onConfirm, onCancel }) =>
    visible ? (
      <div data-testid="entity-delete-modal">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null
  ),
}));

describe('TestDefinitionList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component with test definitions table', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-table')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Column Values To Be Not Null')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Table Row Count To Be Between')
    ).toBeInTheDocument();
  });

  it('should render all table columns', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const tableHeaders = screen.getAllByRole('columnheader');
      const labels = tableHeaders.map((header) => header.textContent);

      expect(labels).toContain('label.name');
      expect(labels).toContain('label.description');
      expect(labels).toContain('label.entity-type');
      expect(labels).toContain('label.test-platform-plural');
      expect(labels).toContain('label.enabled');
      expect(labels).toContain('label.action-plural');
    });
  });

  it('should fetch test definitions on mount', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(getListTestDefinitions).toHaveBeenCalledWith({
        after: undefined,
        before: undefined,
        limit: 15,
      });
    });
  });

  it('should render enabled switch for each test definition', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const switches = await screen.findAllByRole('switch');

    expect(switches).toHaveLength(4);
  });

  it('should call patchTestDefinition when enable switch is toggled', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-table')).toBeInTheDocument();
    });

    const switches = await screen.findAllByRole('switch');
    fireEvent.click(switches[1]);

    await waitFor(() => {
      expect(patchTestDefinition).toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalled();
    });
  });

  it('should render edit and delete action buttons', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const editButtons = await screen.findAllByTestId(/edit-test-definition-/);
    const deleteButtons = await screen.findAllByTestId(
      /delete-test-definition-/
    );

    expect(editButtons).toHaveLength(4);
    expect(deleteButtons).toHaveLength(4);
  });

  it('should open form drawer when edit button is clicked', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const editButtons = screen.getAllByTestId(/edit-test-definition-/);
      fireEvent.click(editButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-form')).toBeInTheDocument();
    });
  });

  it('should show delete confirmation modal when delete button is clicked', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const deleteButtons = screen.getAllByTestId(/delete-test-definition-/);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('entity-delete-modal')).toBeInTheDocument();
    });
  });

  it('should call deleteTestDefinitionByFqn when delete is confirmed', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const deleteButtons = screen.getAllByTestId(/delete-test-definition-/);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(deleteTestDefinitionByFqn).toHaveBeenCalledWith(
        'columnValuesToBeNotNull'
      );
      expect(showSuccessToast).toHaveBeenCalled();
    });
  });

  it('should reset pagination to page 1 after delete', async () => {
    const mockHandlePageChange = jest.fn();
    const { usePaging } = jest.requireMock('../../../hooks/paging/usePaging');

    (usePaging as jest.Mock).mockReturnValue({
      currentPage: 3,
      pageSize: 15,
      paging: { total: 50 },
      handlePagingChange: jest.fn(),
      handlePageChange: mockHandlePageChange,
      handlePageSizeChange: jest.fn(),
      showPagination: true,
    });

    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const deleteButtons = screen.getAllByTestId(/delete-test-definition-/);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });
    });
  });

  it('should reset pagination to page 1 after create', async () => {
    const mockHandlePageChange = jest.fn();
    const { usePaging } = jest.requireMock('../../../hooks/paging/usePaging');

    (usePaging as jest.Mock).mockReturnValue({
      currentPage: 2,
      pageSize: 15,
      paging: { total: 30 },
      handlePagingChange: jest.fn(),
      handlePageChange: mockHandlePageChange,
      handlePageSizeChange: jest.fn(),
      showPagination: true,
    });

    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const addButton = await screen.findByTestId('add-test-definition-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-form')).toBeInTheDocument();
    });

    const onSuccessCallback = (TestDefinitionForm as jest.Mock).mock.calls[0][0]
      .onSuccess;
    onSuccessCallback();

    await waitFor(() => {
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });
    });
  });

  it('should render add test definition button', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(
        screen.getByTestId('add-test-definition-button')
      ).toBeInTheDocument();
    });
  });

  it('should open form drawer when add button is clicked', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const addButton = await screen.findByTestId('add-test-definition-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-form')).toBeInTheDocument();
    });
  });

  it('should show error toast when API call fails', async () => {
    const mockError = new Error('API Error');

    (getListTestDefinitions as jest.Mock).mockRejectedValueOnce(mockError);

    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('should refresh list after successful create/update', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const addButton = await screen.findByTestId('add-test-definition-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId('test-definition-form')).toBeInTheDocument();
    });

    const initialCallCount = (getListTestDefinitions as jest.Mock).mock.calls
      .length;

    const onSuccessCallback = (TestDefinitionForm as jest.Mock).mock.calls[0][0]
      .onSuccess;
    onSuccessCallback();

    await waitFor(() => {
      expect(getListTestDefinitions).toHaveBeenCalledTimes(
        initialCallCount + 1
      );
    });
  });

  it('should disable edit and delete buttons for System test definitions', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      const editButtons = screen.getAllByTestId(/edit-test-definition-/);
      const deleteButtons = screen.getAllByTestId(/delete-test-definition-/);

      // First definition is User provider - should be enabled
      expect(editButtons[0]).not.toBeDisabled();
      expect(deleteButtons[0]).not.toBeDisabled();

      // Second definition is System provider - should be disabled
      expect(editButtons[1]).toBeDisabled();
      expect(deleteButtons[1]).toBeDisabled();
    });
  });

  it('should not fetch permissions for System test definitions', async () => {
    const mockGetEntityPermissionByFqn = jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      ViewBasic: true,
      EditAll: true,
    });

    const { usePermissionProvider } = jest.requireMock(
      '../../../context/PermissionProvider/PermissionProvider'
    );

    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
      permissions: {
        testDefinition: {
          Create: true,
          Delete: true,
          ViewAll: true,
          ViewBasic: true,
          EditAll: true,
        },
      },
    });

    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    await waitFor(() => {
      // Permissions fetched for all definitions (including system and external)
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(4);
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.TEST_DEFINITION,
        'columnValuesToBeNotNull'
      );
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.TEST_DEFINITION,
        'tableRowCountToBeBetween'
      );
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.TEST_DEFINITION,
        'dbtSchemaTest'
      );
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.TEST_DEFINITION,
        'greatExpectationsTest'
      );
    });
  });

  it('should enable switch when user has EditAll permission', async () => {
    render(<TestDefinitionList />, { wrapper: MemoryRouter });

    const switches = await screen.findAllByRole('switch');

    // First two OpenMetadata test definitions should be enabled with EditAll permission
    // External tests (indexes 2 and 3) remain disabled regardless of permissions
    expect(switches[0]).not.toBeDisabled();
    expect(switches[1]).not.toBeDisabled();
    expect(switches[2]).toBeDisabled();
    expect(switches[3]).toBeDisabled();
  });

  describe('External Test Definition Handling', () => {
    it('should disable toggle switch for external test definitions', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const switches = await screen.findAllByRole('switch');

      // Third definition (dbt) should be disabled (external)
      expect(switches[2]).toBeDisabled();

      // Fourth definition (GreatExpectations) should be disabled (external)
      expect(switches[3]).toBeDisabled();
    });

    it('should show correct tooltip for external test toggle', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const switches = await screen.findAllByRole('switch');
      const externalSwitch = switches[2];

      // External test switches should be disabled (tooltip explains why when hovered)
      expect(externalSwitch).toBeDisabled();
    });

    it('should not call patchTestDefinition when external test toggle is clicked', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const switches = await screen.findAllByRole('switch');
      const externalSwitch = switches[2];

      const initialCallCount = (patchTestDefinition as jest.Mock).mock.calls
        .length;

      fireEvent.click(externalSwitch);

      await waitFor(() => {
        expect(patchTestDefinition).toHaveBeenCalledTimes(initialCallCount);
      });
    });

    it('should allow toggling OpenMetadata test definitions', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const switches = await screen.findAllByRole('switch');
      const omSwitch = switches[0];

      expect(omSwitch).not.toBeDisabled();

      fireEvent.click(omSwitch);

      await waitFor(() => {
        expect(patchTestDefinition).toHaveBeenCalled();
        expect(showSuccessToast).toHaveBeenCalled();
      });
    });

    it('should display all test definitions including external ones', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(
          screen.getByText('Column Values To Be Not Null')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Table Row Count To Be Between')
        ).toBeInTheDocument();
        expect(screen.getByText('DBT Schema Test')).toBeInTheDocument();
        expect(screen.getByText('Great Expectations Test')).toBeInTheDocument();
      });
    });

    it('should show correct test platforms for external tests', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(screen.getByText('dbt')).toBeInTheDocument();
        expect(screen.getByText('GreatExpectations')).toBeInTheDocument();
      });
    });

    it('should render 4 test definitions with correct switch states', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const switches = await screen.findAllByRole('switch');

      expect(switches).toHaveLength(4);

      // OpenMetadata tests - enabled, not disabled
      expect(switches[0]).toBeChecked();
      expect(switches[0]).not.toBeDisabled();

      // System OpenMetadata test - not checked, not disabled (has EditAll)
      expect(switches[1]).not.toBeChecked();
      expect(switches[1]).not.toBeDisabled();

      // External DBT test - checked, but disabled
      expect(switches[2]).toBeChecked();
      expect(switches[2]).toBeDisabled();

      // External GE test - not checked, and disabled
      expect(switches[3]).not.toBeChecked();
      expect(switches[3]).toBeDisabled();
    });

    it('should disable toggle for external tests even with EditAll permission', async () => {
      const { usePermissionProvider } = jest.requireMock(
        '../../../context/PermissionProvider/PermissionProvider'
      );

      (usePermissionProvider as jest.Mock).mockReturnValue({
        getEntityPermissionByFqn: jest.fn().mockResolvedValue({
          Create: true,
          Delete: true,
          ViewAll: true,
          ViewBasic: true,
          EditAll: true,
        }),
        permissions: {
          testDefinition: {
            Create: true,
            Delete: true,
            ViewAll: true,
            ViewBasic: true,
            EditAll: true,
          },
        },
      });

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const switches = await screen.findAllByRole('switch');

      // External tests should remain disabled even with EditAll permission
      expect(switches[2]).toBeDisabled();
      expect(switches[3]).toBeDisabled();
    });
  });

  describe('Permission-based Toggle Behavior', () => {
    it('should disable enabled switch when user lacks EditAll permission', async () => {
      const mockGetEntityPermission = jest.fn().mockResolvedValue({
        Create: false,
        Delete: false,
        ViewAll: true,
        ViewBasic: true,
        EditAll: false,
      });

      const { usePermissionProvider } = jest.requireMock(
        '../../../context/PermissionProvider/PermissionProvider'
      );

      (usePermissionProvider as jest.Mock).mockReturnValue({
        getEntityPermissionByFqn: mockGetEntityPermission,
        permissions: {
          testDefinition: {
            Create: true,
            Delete: true,
            ViewAll: true,
            ViewBasic: true,
            EditAll: true,
          },
        },
      });

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(mockGetEntityPermission).toHaveBeenCalled();
      });

      const switches = await screen.findAllByRole('switch');

      // All switches should be disabled due to lack of EditAll permission
      expect(switches[0]).toBeDisabled();
      expect(switches[1]).toBeDisabled();
      expect(switches[2]).toBeDisabled();
      expect(switches[3]).toBeDisabled();
    });
  });

  describe('Filter Functionality', () => {
    it('should initialize with useTableFilters hook', () => {
      const { useTableFilters } = jest.requireMock(
        '../../../hooks/useTableFilters'
      );

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      expect(useTableFilters).toHaveBeenCalledWith({
        entityType: undefined,
        testPlatforms: undefined,
      });
    });

    it('should initialize filter hooks with correct configuration', () => {
      const { useQuickFiltersWithComponent } = jest.requireMock(
        '../../common/atoms/filters/useQuickFiltersWithComponent'
      );

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      expect(useQuickFiltersWithComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'single',
          searchIndex: 'all',
        })
      );
    });

    it('should parse filters from URL params', () => {
      const { useTableFilters } = jest.requireMock(
        '../../../hooks/useTableFilters'
      );

      (useTableFilters as jest.Mock).mockReturnValue({
        filters: {
          entityType: 'TABLE',
          testPlatforms: 'OpenMetadata,DBT',
        },
        setFilters: jest.fn(),
      });

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const { useQuickFiltersWithComponent } = jest.requireMock(
        '../../common/atoms/filters/useQuickFiltersWithComponent'
      );

      const parsedFilters =
        useQuickFiltersWithComponent.mock.calls[0][0].parsedFilters;

      expect(parsedFilters).toBeDefined();
      expect(parsedFilters).toHaveLength(2);
    });

    it('should reset pagination when filters change', async () => {
      const mockHandlePageChange = jest.fn();
      const mockUpdateUrlParams = jest.fn();

      const { usePaging } = jest.requireMock('../../../hooks/paging/usePaging');
      const { useTableFilters } = jest.requireMock(
        '../../../hooks/useTableFilters'
      );

      (usePaging as jest.Mock).mockReturnValue({
        currentPage: 2,
        pageSize: 15,
        paging: { total: 30 },
        handlePagingChange: jest.fn(),
        handlePageChange: mockHandlePageChange,
        handlePageSizeChange: jest.fn(),
        showPagination: true,
        pagingCursor: {
          cursorType: undefined,
          cursorValue: undefined,
          currentPage: '2',
          pageSize: 15,
        },
      });

      (useTableFilters as jest.Mock).mockReturnValue({
        filters: {
          entityType: undefined,
          testPlatforms: undefined,
        },
        setFilters: mockUpdateUrlParams,
      });

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const { useQuickFiltersWithComponent } = jest.requireMock(
        '../../common/atoms/filters/useQuickFiltersWithComponent'
      );

      const onFilterChange =
        useQuickFiltersWithComponent.mock.calls[0][0].onFilterChange;

      const mockFilters = [
        {
          key: 'entityType',
          label: 'label.entity-type',
          value: [{ key: 'TABLE', label: 'Table' }],
        },
      ];

      onFilterChange(mockFilters);

      await waitFor(() => {
        expect(mockUpdateUrlParams).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: 'TABLE',
            testPlatforms: null,
          })
        );
        expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
          cursorType: null,
          cursorValue: undefined,
        });
      });
    });

    it('should clear filters when empty array is passed', async () => {
      const mockUpdateUrlParams = jest.fn();

      const { useTableFilters } = jest.requireMock(
        '../../../hooks/useTableFilters'
      );

      (useTableFilters as jest.Mock).mockReturnValue({
        filters: {
          entityType: 'TABLE',
          testPlatforms: 'OpenMetadata',
        },
        setFilters: mockUpdateUrlParams,
      });

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const { useQuickFiltersWithComponent } = jest.requireMock(
        '../../common/atoms/filters/useQuickFiltersWithComponent'
      );

      const onFilterChange =
        useQuickFiltersWithComponent.mock.calls[0][0].onFilterChange;

      onFilterChange([]);

      await waitFor(() => {
        expect(mockUpdateUrlParams).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: null,
            testPlatforms: null,
          })
        );
      });
    });

    it('should handle multiple filter selections', async () => {
      const mockUpdateUrlParams = jest.fn();

      const { useTableFilters } = jest.requireMock(
        '../../../hooks/useTableFilters'
      );

      (useTableFilters as jest.Mock).mockReturnValue({
        filters: {
          entityType: undefined,
          testPlatforms: undefined,
        },
        setFilters: mockUpdateUrlParams,
      });

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const { useQuickFiltersWithComponent } = jest.requireMock(
        '../../common/atoms/filters/useQuickFiltersWithComponent'
      );

      const onFilterChange =
        useQuickFiltersWithComponent.mock.calls[0][0].onFilterChange;

      const mockFilters = [
        {
          key: 'entityType',
          label: 'label.entity-type',
          value: [{ key: 'COLUMN', label: 'Column' }],
        },
        {
          key: 'testPlatforms',
          label: 'label.test-platform-plural',
          value: [{ key: 'DBT', label: 'DBT' }],
        },
      ];

      onFilterChange(mockFilters);

      await waitFor(() => {
        expect(mockUpdateUrlParams).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: 'COLUMN',
            testPlatforms: 'DBT',
          })
        );
      });
    });

    it('should call updateUrlParams and handlePageChange when filters change', async () => {
      const mockUpdateUrlParams = jest.fn();
      const mockHandlePageChange = jest.fn();

      const { useTableFilters } = jest.requireMock(
        '../../../hooks/useTableFilters'
      );
      const { usePaging } = jest.requireMock('../../../hooks/paging/usePaging');

      (useTableFilters as jest.Mock).mockReturnValue({
        filters: {
          entityType: undefined,
          testPlatforms: undefined,
        },
        setFilters: mockUpdateUrlParams,
      });

      (usePaging as jest.Mock).mockReturnValue({
        currentPage: 1,
        pageSize: 15,
        paging: { total: 4 },
        handlePagingChange: jest.fn(),
        handlePageChange: mockHandlePageChange,
        handlePageSizeChange: jest.fn(),
        showPagination: false,
        pagingCursor: {
          cursorType: undefined,
          cursorValue: undefined,
          currentPage: '1',
          pageSize: 15,
        },
      });

      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      const { useQuickFiltersWithComponent } = jest.requireMock(
        '../../common/atoms/filters/useQuickFiltersWithComponent'
      );

      const onFilterChange =
        useQuickFiltersWithComponent.mock.calls[0][0].onFilterChange;

      const mockFilters = [
        {
          key: 'entityType',
          label: 'label.entity-type',
          value: [{ key: 'TABLE', label: 'Table' }],
        },
      ];

      onFilterChange(mockFilters);

      await waitFor(() => {
        expect(mockUpdateUrlParams).toHaveBeenCalled();
        expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
          cursorType: null,
          cursorValue: undefined,
        });
      });
    });

    it('should render quick filters component', async () => {
      render(<TestDefinitionList />, { wrapper: MemoryRouter });

      await waitFor(() => {
        expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      });
    });
  });
});
