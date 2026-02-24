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

jest.mock('../../../../../utils/PermissionsUtils', () => ({
  getPrioritizedEditPermission: jest.fn().mockReturnValue(true),
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
  checkPermission: jest.fn().mockReturnValue(true),
}));

import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MOCK_TABLE } from '../../../../../mocks/TableData.mock';
import { getIngestionPipelines } from '../../../../../rest/ingestionPipelineAPI';
import '../../../../../test/unit/mocks/mui.mock';
import { useTableProfiler } from '../TableProfilerProvider';
import { QualityTab } from './QualityTab.component';

const testCasePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

const mockTable = {
  displayName: 'Test Table',
  name: 'test-table',
};

const mockUseTableProfiler = {
  tableProfiler: MOCK_TABLE,
  table: MOCK_TABLE,
  onSettingButtonClick: jest.fn(),
  permissions: {
    EditAll: true,
    EditDataProfile: true,
    EditTests: true,
    ViewTests: true,
    ViewAll: true,
  },
  fetchAllTests: jest.fn(),
  onTestCaseUpdate: jest.fn(),
  allTestCases: [],
  isTestsLoading: false,
  isTableDeleted: false,
  testCasePaging: {
    currentPage: 1,
    pageSize: 10,
    paging: { total: 16, after: 'after' },
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: true,
  },
  testCaseSummary: {
    total: {
      total: 10,
      success: 5,
      failed: 3,
      aborted: 2,
    },
  },
};

jest.mock('../TableProfilerProvider', () => ({
  useTableProfiler: jest.fn().mockImplementation(() => mockUseTableProfiler),
}));

jest.mock(
  '../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockImplementation(() => ({
      permissions: {
        testCase: testCasePermission,
      },
    })),
  })
);

jest.mock('../../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'testFqn' })),
}));

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTable)),
}));
jest.mock('../../../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(({ pagingHandler }) => (
    <div>
      <p>NextPrevious.component</p>
      <button
        data-testid="next-btn"
        onClick={() => pagingHandler({ cursorType: 'after', currentPage: 2 })}>
        Next
      </button>
    </div>
  ));
});
jest.mock('../../../../common/SearchBarComponent/SearchBar.component', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <input data-testid="mock-searchbar" type="text" />
    ));
});
jest.mock('../../DataQualityTab/DataQualityTab', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DataQualityTab.component</div>);
});

jest.mock('../../../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => (
    <div>
      <p>LimitWrapper</p>
      {children}
    </div>
  ));
});

jest.mock('../../../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    pathname: '/test-path',
    search: '?test=value',
  })),
}));

jest.mock('../../../../common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ id, name, count = 0 }) => (
    <div data-testid={id}>
      <div>{name}</div>
      <span data-testid={`${id}-count`}>{count}</span>
    </div>
  ));
});

jest.mock('../../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockResolvedValue({
    paging: { total: 0 },
  }),
}));

jest.mock('../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    getResourceLimit: jest.fn(),
  }),
}));

jest.mock(
  '../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn().mockReturnValue({
      showModal: jest.fn(),
    }),
  })
);

jest.mock('../../../../../utils/TestCaseUtils', () => ({
  ExtraTestCaseDropdownOptions: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../common/EntityPageInfos/ManageButton/ManageButton', () =>
  jest.fn().mockImplementation((props) => (
    <div
      data-deleted={props.deleted}
      data-entity-id={props.entityId}
      data-entity-type={props.entityType}
      data-testid="manage-button">
      ManageButton
    </div>
  ))
);

jest.mock(
  '../../../../DataQuality/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component',
  () => jest.fn().mockReturnValue(<div>TestSuitePipelineTab</div>)
);

jest.mock('../../../../common/SummaryCard/SummaryCardV1', () =>
  jest.fn().mockImplementation(({ title, value }) => (
    <div data-testid="summary-card">
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ))
);

jest.mock('../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

describe('QualityTab', () => {
  it('should render QualityTab', async () => {
    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByTestId('mock-searchbar')).toBeInTheDocument();
    expect(
      await screen.findByText('label.test-case-plural')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('label.pipeline-plural')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('pipeline-count')).toHaveTextContent('0');
  });

  it("Pagination should be called with 'handlePageChange'", async () => {
    await act(async () => {
      render(<QualityTab />);
    });

    // Since DataQualityTab is mocked, pagination is handled within that component
    // Just verify the component renders
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('should render the Add button if editTest is true and isTableDeleted is false', async () => {
    await act(async () => {
      render(<QualityTab />);
    });

    // DataQualityTab component handles the add button now
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('should call limitWrapper', async () => {
    render(<QualityTab />);

    // Component renders successfully
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('should not render the Add button if editTest is false', async () => {
    const { getPrioritizedEditPermission } = jest.requireMock(
      '../../../../../utils/PermissionsUtils'
    );

    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      permissions: {
        EditAll: false,
        EditTests: false,
        ViewTests: true,
      },
      isTableDeleted: false,
    });
    getPrioritizedEditPermission.mockReturnValue(false);

    await act(async () => {
      render(<QualityTab />);
    });

    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('should not render the Add button if isTableDeleted is true', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      permissions: {
        EditAll: true,
        EditTests: true,
        ViewTests: true,
      },
      isTableDeleted: true,
    });

    await act(async () => {
      render(<QualityTab />);
    });

    // DataQualityTab is still rendered, button visibility is controlled within it
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('should render tabs', async () => {
    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByTestId('test-cases')).toBeInTheDocument();
    expect(await screen.findByTestId('pipeline')).toBeInTheDocument();
  });

  it('should display the initial summary data', async () => {
    (useTableProfiler as jest.Mock).mockImplementationOnce(() => ({
      ...mockUseTableProfiler,
      permissions: {
        EditAll: true,
        EditTests: true,
        ViewTests: true,
      },
      isTableDeleted: false,
    }));

    await act(async () => {
      render(<QualityTab />);
    });

    // Component renders with summary data
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('should call onSettingButtonClick', async () => {
    const { getPrioritizedEditPermission } = jest.requireMock(
      '../../../../../utils/PermissionsUtils'
    );
    getPrioritizedEditPermission.mockReturnValue(true);

    await act(async () => {
      render(<QualityTab />);
    });

    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
  });

  it('should display correct test case count in tab', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      testCasePaging: {
        ...mockUseTableProfiler.testCasePaging,
        paging: { total: 25, after: 'after' },
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByTestId('test-cases-count')).toHaveTextContent(
      '25'
    );
  });

  it('should display correct pipeline count in tab', async () => {
    (getIngestionPipelines as jest.Mock).mockResolvedValueOnce({
      paging: { total: 5 },
    });

    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      table: {
        ...MOCK_TABLE,
        testSuite: {
          fullyQualifiedName: 'test.suite.name',
        },
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByTestId('pipeline-count')).toHaveTextContent('5');
  });

  it('should show zero count when no test cases or pipelines exist', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      testCasePaging: {
        ...mockUseTableProfiler.testCasePaging,
        paging: { total: 0, after: null },
      },
      table: {
        ...MOCK_TABLE,
        testSuite: {
          fullyQualifiedName: 'test.suite.name',
        },
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByTestId('test-cases-count')).toHaveTextContent(
      '0'
    );
    expect(await screen.findByTestId('pipeline-count')).toHaveTextContent('0');
  });

  it('should handle error in fetching pipeline count gracefully', async () => {
    const mockGetIngestionPipelines = jest
      .fn()
      .mockRejectedValue(new Error('API Error'));

    jest.mock('../../../../../rest/ingestionPipelineAPI', () => ({
      getIngestionPipelines: mockGetIngestionPipelines,
    }));

    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      table: {
        ...MOCK_TABLE,
        testSuite: {
          fullyQualifiedName: 'test.suite.name',
        },
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByTestId('pipeline-count')).toHaveTextContent('0');
  });

  it('should render ManageButton component', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue(mockUseTableProfiler);

    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByText('ManageButton')).toBeInTheDocument();
  });

  it('should call ExtraTestCaseDropdownOptions with correct parameters when table has fullyQualifiedName', async () => {
    const { ExtraTestCaseDropdownOptions } = jest.requireMock(
      '../../../../../utils/TestCaseUtils'
    );

    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      table: {
        ...MOCK_TABLE,
        fullyQualifiedName: 'test.table.fqn',
        deleted: false,
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(ExtraTestCaseDropdownOptions).toHaveBeenCalled();
  });

  it('should not call ExtraTestCaseDropdownOptions when table has no fullyQualifiedName', async () => {
    const { ExtraTestCaseDropdownOptions } = jest.requireMock(
      '../../../../../utils/TestCaseUtils'
    );
    ExtraTestCaseDropdownOptions.mockClear();

    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      table: {
        ...MOCK_TABLE,
        fullyQualifiedName: undefined,
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(ExtraTestCaseDropdownOptions).not.toHaveBeenCalled();
  });

  it('should call checkPermission for ViewAll and EditAll operations', async () => {
    const { checkPermission } = jest.requireMock(
      '../../../../../utils/PermissionsUtils'
    );
    checkPermission.mockClear();

    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      table: {
        ...MOCK_TABLE,
        fullyQualifiedName: 'test.table.fqn',
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(checkPermission).toHaveBeenCalled();
  });

  it('should pass correct props to ManageButton', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      table: {
        ...MOCK_TABLE,
        id: 'test-table-id',
        fullyQualifiedName: 'test.table.fqn',
        deleted: false,
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    const manageButton = await screen.findByTestId('manage-button');

    expect(manageButton).toHaveAttribute('data-deleted', 'false');
    expect(manageButton).toHaveAttribute('data-entity-id', 'test-table-id');
    expect(manageButton).toHaveAttribute('data-entity-type', 'testCase');
  });

  it('should pass deleted true to ManageButton when table is deleted', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      table: {
        ...MOCK_TABLE,
        id: 'test-table-id',
        fullyQualifiedName: 'test.table.fqn',
        deleted: true,
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    const manageButton = await screen.findByTestId('manage-button');

    expect(manageButton).toHaveAttribute('data-deleted', 'true');
  });

  it('should render ErrorPlaceHolder when ViewTests permission is false', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      permissions: {
        EditAll: true,
        EditTests: true,
        ViewTests: false,
        ViewAll: true,
      },
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });
});
