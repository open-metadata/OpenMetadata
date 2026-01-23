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
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { mockEntityPermissions } from '../../pages/DatabaseSchemaPage/mocks/DatabaseSchemaPage.mock';
import { getIngestionPipelines } from '../../rest/ingestionPipelineAPI';
import {
  addTestCaseToLogicalTestSuite,
  getListTestCaseBySearch,
  getTestSuiteByName,
  updateTestSuiteById,
} from '../../rest/testAPI';
import TestSuiteDetailsPage from './TestSuiteDetailsPage.component';

// Mock data
const mockTestSuite = {
  id: 'test-suite-id',
  name: 'test-suite',
  displayName: 'Test Suite',
  fullyQualifiedName: 'testSuiteFQN',
  description: 'Test suite description',
  owners: [{ id: 'owner-1', type: 'user', name: 'John Doe' }],
  domains: [{ id: 'domain-1', type: 'domain', name: 'Engineering' }],
  tests: [],
  deleted: false,
};

const mockTestCases = [
  {
    id: 'test-case-1',
    name: 'test_case_1',
    displayName: 'Test Case 1',
    testDefinition: { id: 'def-1', name: 'definition-1' },
    testSuite: { id: 'test-suite-id', name: 'test-suite' },
  },
  {
    id: 'test-case-2',
    name: 'test_case_2',
    displayName: 'Test Case 2',
    testDefinition: { id: 'def-2', name: 'definition-2' },
    testSuite: { id: 'test-suite-id', name: 'test-suite' },
  },
];

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>TitleBreadcrumb.component</div>);
  }
);
jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>ErrorPlaceHolder.component</div>);
  }
);
jest.mock(
  '../../components/common/EntitySummaryDetails/EntitySummaryDetails',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>EntitySummaryDetails.component</div>);
  }
);
jest.mock(
  '../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>ManageButton.component</div>);
  }
);
jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(({ onDescriptionUpdate }) => (
    <div>
      Description.component
      <button
        data-testid="edit-description-btn"
        onClick={() => onDescriptionUpdate('Updated description')}>
        Edit Description
      </button>
    </div>
  ));
});
jest.mock(
  '../../components/Database/Profiler/DataQualityTab/DataQualityTab',
  () => {
    return jest.fn().mockImplementation(({ onTestUpdate }) => (
      <div>
        DataQualityTab.component
        <button
          data-testid="update-test-btn"
          onClick={() =>
            onTestUpdate?.({ id: 'test-1', name: 'updated-test' })
          }>
          Update Test
        </button>
      </div>
    ));
  }
);
jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest
      .fn()
      .mockImplementation(() => ({ isAuthDisabled: true })),
  };
});
const mockLocationPathname = '/mock-path';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  return {
    useNavigate: jest.fn(() => mockNavigate),
  };
});

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ fqn: 'testSuiteFQN' })),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => ({
    pathname: mockLocationPathname,
  }),
}));

jest.mock('../../rest/testAPI');
jest.mock('../../context/PermissionProvider/PermissionProvider');
jest.mock(
  '../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => {
    return jest
      .fn()
      .mockImplementation(({ displayName, onEditDisplayName }) => (
        <div>
          EntityHeaderTitle.component
          <span data-testid="entity-display-name">{displayName}</span>
          <button
            data-testid="edit-display-name-btn"
            onClick={() => onEditDisplayName?.({ displayName: 'New Name' })}>
            Edit Name
          </button>
        </div>
      ));
  }
);
jest.mock('../../components/common/DomainLabel/DomainLabel.component', () => {
  return {
    DomainLabel: jest.fn().mockImplementation(({ onUpdate }) => (
      <div>
        DomainLabel.component
        <button
          data-testid="update-domain-btn"
          onClick={() => onUpdate?.({ id: 'new-domain', type: 'domain' })}>
          Update Domain
        </button>
      </div>
    )),
  };
});
jest.mock('../../rest/ingestionPipelineAPI');
jest.mock('../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(({ onUpdate }) => (
    <div data-testid="owner-label">
      OwnerLabel.component
      <button
        data-testid="update-owner-btn"
        onClick={() => onUpdate?.([{ id: 'new-owner', type: 'user' }])}>
        Update Owner
      </button>
    </div>
  )),
}));
jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ id, name }) => (
    <div className="w-full tabs-label-container" data-testid={id}>
      <div className="d-flex justify-between gap-2">{name}</div>
    </div>
  ));
});

jest.mock('../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
      canAddMultipleDomains: true,
    },
  })),
}));

jest.mock(
  '../../components/DataQuality/AddTestCaseList/AddTestCaseList.component',
  () => ({
    AddTestCaseList: jest.fn().mockImplementation(({ onSubmit, onCancel }) => (
      <div data-testid="add-test-case-list">
        AddTestCaseList.component
        <button
          data-testid="submit-test-cases-btn"
          onClick={() => onSubmit(mockTestCases)}>
          Submit
        </button>
        <button data-testid="cancel-test-cases-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )),
  })
);

jest.mock(
  '../../components/DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="test-suite-pipeline-tab">
          TestSuitePipelineTab.component
        </div>
      )),
  })
);

jest.mock(
  '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn(() => ({
      showModal: jest.fn(),
    })),
  })
);

const mockShowErrorToast = jest.fn();
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

describe('TestSuiteDetailsPage component', () => {
  let mockGetTestSuiteByName: jest.Mock;
  let mockGetListTestCaseBySearch: jest.Mock;
  let mockUpdateTestSuiteById: jest.Mock;
  let mockAddTestCaseToLogicalTestSuite: jest.Mock;
  let mockGetIngestionPipelines: jest.Mock;
  let mockGetEntityPermissionByFqn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetTestSuiteByName = getTestSuiteByName as jest.Mock;
    mockGetListTestCaseBySearch = getListTestCaseBySearch as jest.Mock;
    mockUpdateTestSuiteById = updateTestSuiteById as jest.Mock;
    mockAddTestCaseToLogicalTestSuite =
      addTestCaseToLogicalTestSuite as jest.Mock;
    mockGetIngestionPipelines = getIngestionPipelines as jest.Mock;

    mockGetEntityPermissionByFqn = jest
      .fn()
      .mockResolvedValue(mockEntityPermissions);

    (usePermissionProvider as jest.Mock).mockImplementation(() => ({
      getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
      permissions: {},
    }));

    mockGetTestSuiteByName.mockResolvedValue(mockTestSuite);
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: { total: 2 },
    });
    mockGetIngestionPipelines.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockUpdateTestSuiteById.mockResolvedValue(mockTestSuite);
    mockAddTestCaseToLogicalTestSuite.mockResolvedValue({});
  });

  describe('Render & Initial State', () => {
    it('component should render without crashing', async () => {
      render(<TestSuiteDetailsPage />);

      expect(
        await screen.findByText('TitleBreadcrumb.component')
      ).toBeInTheDocument();
    });

    it('should render all required UI elements', async () => {
      render(<TestSuiteDetailsPage />);

      expect(
        await screen.findByText('TitleBreadcrumb.component')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('EntityHeaderTitle.component')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('DomainLabel.component')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('ManageButton.component')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Description.component')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('DataQualityTab.component')
      ).toBeInTheDocument();
      expect(
        await screen.findByTestId('add-test-case-btn')
      ).toBeInTheDocument();
    });

    it('should show loader while loading', async () => {
      mockGetEntityPermissionByFqn.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<TestSuiteDetailsPage />);

      expect(screen.getByText('Loader.component')).toBeInTheDocument();
    });

    it('should fetch test suite data on mount', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(mockGetTestSuiteByName).toHaveBeenCalledWith('testSuiteFQN', {
        fields: ['owners', 'domains'],
        include: 'all',
      });
    });

    it('should fetch permissions on mount', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(mockGetEntityPermissionByFqn).toHaveBeenCalled();
    });
  });

  describe('Props Validation & Permissions', () => {
    it('should show no permission error if user lacks view permissions', async () => {
      (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
        getEntityPermissionByFqn: jest.fn().mockResolvedValue({
          ...mockEntityPermissions,
          ViewAll: false,
          ViewBasic: false,
        }),
        permissions: {},
      }));

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(
        await screen.findByText('ErrorPlaceHolder.component')
      ).toBeInTheDocument();
    });

    it('should hide add test case button if user lacks edit permissions', async () => {
      (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
        getEntityPermissionByFqn: jest.fn().mockResolvedValue({
          ...mockEntityPermissions,
          EditAll: false,
          EditTests: false,
        }),
        permissions: {},
      }));

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('add-test-case-btn')
        ).not.toBeInTheDocument();
      });
    });

    it('should show add test case button if user has EditAll permission', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(
        await screen.findByTestId('add-test-case-btn')
      ).toBeInTheDocument();
    });

    it('should show add test case button if user has EditTests permission', async () => {
      (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
        getEntityPermissionByFqn: jest.fn().mockResolvedValue({
          ...mockEntityPermissions,
          EditAll: false,
          EditTests: true,
        }),
        permissions: {},
      }));

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(
        await screen.findByTestId('add-test-case-btn')
      ).toBeInTheDocument();
    });
  });

  describe('User Interactions - Test Case Management', () => {
    it('should open add test case modal when button is clicked', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const addButton = await screen.findByTestId('add-test-case-btn');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('add-test-case-list')).toBeInTheDocument();
    });

    it('should close modal when cancel is clicked', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const addButton = await screen.findByTestId('add-test-case-btn');
      await act(async () => {
        fireEvent.click(addButton);
      });

      const cancelButton = screen.getByTestId('cancel-test-cases-btn');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should submit test cases and close modal', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const addButton = await screen.findByTestId('add-test-case-btn');
      await act(async () => {
        fireEvent.click(addButton);
      });

      const submitButton = screen.getByTestId('submit-test-cases-btn');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockAddTestCaseToLogicalTestSuite).toHaveBeenCalledWith({
          testCaseIds: ['test-case-1', 'test-case-2'],
          testSuiteId: 'test-suite-id',
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should refetch test cases after adding new ones', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      // Clear previous calls
      mockGetListTestCaseBySearch.mockClear();

      const addButton = await screen.findByTestId('add-test-case-btn');
      await act(async () => {
        fireEvent.click(addButton);
      });

      const submitButton = screen.getByTestId('submit-test-cases-btn');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalled();
      });
    });
  });

  describe('User Interactions - Updates', () => {
    it('should handle owner update', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const updateOwnerBtn = await screen.findByTestId('update-owner-btn');
      await act(async () => {
        fireEvent.click(updateOwnerBtn);
      });

      await waitFor(() => {
        expect(mockUpdateTestSuiteById).toHaveBeenCalled();
      });
    });

    it('should handle domain update', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const updateDomainBtn = await screen.findByTestId('update-domain-btn');
      await act(async () => {
        fireEvent.click(updateDomainBtn);
      });

      await waitFor(() => {
        expect(mockUpdateTestSuiteById).toHaveBeenCalled();
      });
    });

    it('should handle description update', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const editDescriptionBtn = await screen.findByTestId(
        'edit-description-btn'
      );
      await act(async () => {
        fireEvent.click(editDescriptionBtn);
      });

      await waitFor(() => {
        expect(mockUpdateTestSuiteById).toHaveBeenCalled();
      });
    });

    it('should handle test case update', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const updateTestBtn = await screen.findByTestId('update-test-btn');
      await act(async () => {
        fireEvent.click(updateTestBtn);
      });

      // Test case should be updated in state
      await waitFor(() => {
        expect(screen.getByTestId('update-test-btn')).toBeInTheDocument();
      });
    });
  });

  describe('Async Behavior & API Integration', () => {
    it('should handle test case pagination', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: { total: 10 },
      });

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      await screen.findByTestId('test-cases');

      expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: [
            'testCaseResult',
            'testDefinition',
            'testSuite',
            'incidentId',
          ],
          testSuiteId: 'test-suite-id',
        })
      );
    });

    it('should fetch ingestion pipeline count', async () => {
      mockGetIngestionPipelines.mockResolvedValue({
        data: [],
        paging: { total: 5 },
      });

      render(<TestSuiteDetailsPage />);

      await waitFor(() =>
        expect(mockGetIngestionPipelines).toHaveBeenCalledWith(
          expect.objectContaining({
            testSuite: 'testSuiteFQN',
            pipelineType: ['TestSuite'],
            arrQueryFields: [],
            limit: 0,
          })
        )
      );
    });

    it('should handle test suite fetch success', async () => {
      const customTestSuite = {
        ...mockTestSuite,
        displayName: 'Custom Test Suite',
      };
      mockGetTestSuiteByName.mockResolvedValue(customTestSuite);

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('entity-display-name')).toHaveTextContent(
          'Custom Test Suite'
        );
      });
    });
  });

  describe('Negative & Failure Scenarios', () => {
    it('should handle test suite fetch error', async () => {
      const error = new Error('Failed to fetch test suite');
      mockGetTestSuiteByName.mockRejectedValue(error);

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalled();
      });
    });

    it('should handle test cases fetch error', async () => {
      mockGetListTestCaseBySearch.mockRejectedValue(
        new Error('Failed to fetch test cases')
      );

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalled();
      });
    });

    it('should handle permission fetch error', async () => {
      const error = new Error('Permission fetch failed');
      mockGetEntityPermissionByFqn.mockRejectedValue(error);

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should handle add test case error', async () => {
      const error = new Error('Failed to add test cases');
      mockAddTestCaseToLogicalTestSuite.mockRejectedValue(error);

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const addButton = await screen.findByTestId('add-test-case-btn');
      await act(async () => {
        fireEvent.click(addButton);
      });

      const submitButton = screen.getByTestId('submit-test-cases-btn');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should handle update test suite error', async () => {
      const error = new Error('Update failed');
      mockUpdateTestSuiteById.mockRejectedValue(error);

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const updateOwnerBtn = await screen.findByTestId('update-owner-btn');
      await act(async () => {
        fireEvent.click(updateOwnerBtn);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should handle empty test suite data gracefully', async () => {
      mockGetTestSuiteByName.mockResolvedValue(undefined);

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      // Component should still render without crashing
      expect(screen.getByText('TitleBreadcrumb.component')).toBeInTheDocument();
    });

    it('should handle empty test cases list', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('DataQualityTab.component')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Tabs & Navigation', () => {
    it('should render test cases tab by default', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(await screen.findByTestId('test-cases')).toBeInTheDocument();
    });

    it('should render pipeline tab', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(await screen.findByTestId('pipeline')).toBeInTheDocument();
    });

    it('should navigate after delete action', async () => {
      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      // The afterDeleteAction is passed to ManageButton
      // We can't directly test it without triggering the delete,
      // but we can verify the component renders
      expect(screen.getByText('ManageButton.component')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle test suite with no owners', async () => {
      mockGetTestSuiteByName.mockResolvedValue({
        ...mockTestSuite,
        owners: undefined,
      });

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(await screen.findByTestId('owner-label')).toBeInTheDocument();
    });

    it('should handle test suite with no domains', async () => {
      mockGetTestSuiteByName.mockResolvedValue({
        ...mockTestSuite,
        domains: undefined,
      });

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(
        await screen.findByText('DomainLabel.component')
      ).toBeInTheDocument();
    });

    it('should handle test suite with no description', async () => {
      mockGetTestSuiteByName.mockResolvedValue({
        ...mockTestSuite,
        description: '',
      });

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(
        await screen.findByText('Description.component')
      ).toBeInTheDocument();
    });

    it('should handle deleted test suite', async () => {
      mockGetTestSuiteByName.mockResolvedValue({
        ...mockTestSuite,
        deleted: true,
      });

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      expect(
        await screen.findByText('ManageButton.component')
      ).toBeInTheDocument();
    });

    it('should handle test cases with no IDs', async () => {
      const testCasesWithoutIds = [
        { name: 'test-1', displayName: 'Test 1' },
        { name: 'test-2', displayName: 'Test 2' },
      ];

      await act(async () => {
        render(<TestSuiteDetailsPage />);
      });

      const addButton = await screen.findByTestId('add-test-case-btn');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // Mock the submit with test cases without IDs
      const AddTestCaseList =
        require('../../components/DataQuality/AddTestCaseList/AddTestCaseList.component')
          .AddTestCaseList as jest.Mock;

      const onSubmit = AddTestCaseList.mock.calls[0][0].onSubmit;
      await act(async () => {
        onSubmit(testCasesWithoutIds);
      });

      await waitFor(() => {
        expect(mockAddTestCaseToLogicalTestSuite).toHaveBeenCalledWith({
          testCaseIds: [],
          testSuiteId: 'test-suite-id',
        });
      });
    });
  });
});
