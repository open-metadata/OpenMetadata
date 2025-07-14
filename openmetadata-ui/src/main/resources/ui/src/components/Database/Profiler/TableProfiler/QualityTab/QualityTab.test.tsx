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
}));

import { act, fireEvent, render, screen } from '@testing-library/react';
import LimitWrapper from '../../../../../hoc/LimitWrapper';
import { MOCK_TABLE } from '../../../../../mocks/TableData.mock';
import { getIngestionPipelines } from '../../../../../rest/ingestionPipelineAPI';
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
  onSettingButtonClick: jest.fn(),
  permissions: {
    EditAll: true,
    EditDataProfile: true,
    EditTests: true,
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

describe('QualityTab', () => {
  it('should render QualityTab', async () => {
    await act(async () => {
      render(<QualityTab />);
    });

    expect(
      await screen.findByTestId('page-header-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('heading')).toHaveTextContent(
      'label.data-quality'
    );
    expect(await screen.findByTestId('sub-heading')).toHaveTextContent(
      'message.page-sub-header-for-data-quality'
    );
    expect(await screen.findByTestId('mock-searchbar')).toBeInTheDocument();
    expect(
      await screen.findByTestId('profiler-setting-btn')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('label.test-case-plural')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('NextPrevious.component')
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
    const nextBtn = await screen.findByTestId('next-btn');

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(
      mockUseTableProfiler.testCasePaging.handlePageChange
    ).toHaveBeenCalledWith(2);
    expect(mockUseTableProfiler.fetchAllTests).toHaveBeenCalledWith({
      offset: 10,
      testCaseStatus: undefined,
      testCaseType: 'all',
      sortField: 'testCaseResult.timestamp',
      sortType: 'desc',
    });
  });

  it('should render the Add button if editTest is true and isTableDeleted is false', async () => {
    await act(async () => {
      render(<QualityTab />);
    });

    expect(
      await screen.findByTestId('profiler-add-table-test-btn')
    ).toBeInTheDocument();
  });

  it('should call limitWrapper', async () => {
    render(<QualityTab />);
    fireEvent.click(await screen.findByTestId('profiler-add-table-test-btn'));

    expect(LimitWrapper).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'dataQuality' }),
      {}
    );
    expect(await screen.findByText('LimitWrapper')).toBeInTheDocument();
  });

  it('should not render the Add button if editTest is false', async () => {
    const { getPrioritizedEditPermission } = jest.requireMock(
      '../../../../../utils/PermissionsUtils'
    );
    getPrioritizedEditPermission.mockReturnValue(false);

    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      permissions: {
        EditAll: false,
        EditTests: false,
      },
      isTableDeleted: false,
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(
      screen.queryByTestId('profiler-add-table-test-btn')
    ).not.toBeInTheDocument();
  });

  it('should not render the Add button if isTableDeleted is true', async () => {
    (useTableProfiler as jest.Mock).mockReturnValue({
      ...mockUseTableProfiler,
      permissions: {
        EditAll: true,
        EditTests: true,
      },
      isTableDeleted: true,
    });

    await act(async () => {
      render(<QualityTab />);
    });

    expect(
      screen.queryByTestId('profiler-add-table-test-btn')
    ).not.toBeInTheDocument();
  });

  it('should render tabs', async () => {
    await act(async () => {
      render(<QualityTab />);
    });

    const tabs = await screen.findAllByRole('tab');

    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('should display the initial summary data', async () => {
    (useTableProfiler as jest.Mock).mockImplementationOnce(() => ({
      ...mockUseTableProfiler,
      permissions: {
        EditAll: true,
        EditTests: true,
      },
      isTableDeleted: false,
    }));

    await act(async () => {
      render(<QualityTab />);
    });

    expect(await screen.findByText('label.total-entity')).toBeInTheDocument();
    expect(await screen.findByText('label.success')).toBeInTheDocument();
    expect(await screen.findByText('label.aborted')).toBeInTheDocument();
  });

  it('should call onSettingButtonClick', async () => {
    const { getPrioritizedEditPermission } = jest.requireMock(
      '../../../../../utils/PermissionsUtils'
    );
    getPrioritizedEditPermission.mockReturnValue(true);

    await act(async () => {
      render(<QualityTab />);
    });

    const profilerSettingBtn = await screen.findByTestId(
      'profiler-setting-btn'
    );

    await act(async () => {
      fireEvent.click(profilerSettingBtn);
    });

    expect(mockUseTableProfiler.onSettingButtonClick).toHaveBeenCalled();
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
});
