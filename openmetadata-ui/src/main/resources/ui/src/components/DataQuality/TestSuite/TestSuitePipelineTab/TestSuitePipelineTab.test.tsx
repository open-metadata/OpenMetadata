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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-test-renderer';
import { PAGE_SIZE_BASE } from '../../../../constants/constants';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { Table } from '../../../../generated/entity/data/table';
import { IngestionPipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import TestSuitePipelineTab from './TestSuitePipelineTab.component';

const mockTestSuite = {
  id: '6a048962-cd78-4d51-9517-62838720ef97',
  name: 'mySQL.openmetadata_db.openmetadata_db.web_analytic_event.testSuite',
  fullyQualifiedName:
    'mySQL.openmetadata_db.openmetadata_db.web_analytic_event.testSuite',
  tests: [],
  pipelines: [
    {
      id: 'd16c64b6-fb36-4e20-8700-d6f1e2754ef5',
      type: 'ingestionPipeline',
      name: 'web_analytic_event_TestSuite',
      fullyQualifiedName:
        'mySQL.openmetadata_db.openmetadata_db.web_analytic_event.testSuite.web_analytic_event_TestSuite',
      deleted: false,
    },
  ],
  serviceType: 'TestSuite',
  version: 0.1,
  updatedAt: 1692766701920,
  updatedBy: 'admin',
  deleted: false,
  basic: true,
  basicEntityReference: {
    id: 'e926d275-441e-49ee-a073-ad509f625a14',
    type: 'table',
    name: 'web_analytic_event',
    fullyQualifiedName:
      'mySQL.openmetadata_db.openmetadata_db.web_analytic_event',
  },
  summary: {
    success: 0,
    failed: 1,
    aborted: 0,
    total: 1,
  },
  testCaseResultSummary: [],
} as unknown as Table['testSuite'];

const mockPipelines = [
  {
    id: '1',
    name: 'pipeline1',
    sourceConfig: {
      config: {
        testCases: ['test1', 'test2', 'test3'],
      },
    },
  },
  {
    id: '2',
    name: 'pipeline2',
    sourceConfig: {
      config: {
        testCases: ['test1'],
      },
    },
  },
  {
    id: '3',
    name: 'pipeline3',
    sourceConfig: {
      config: {},
    },
  },
];

const mockPaging = {
  after: 'after-id',
  before: 'before-id',
  total: 10,
};

jest.mock('../../../../rest/ingestionPipelineAPI', () => {
  return {
    getIngestionPipelines: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: mockPipelines, paging: mockPaging })
      ),
  };
});

jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
    }),
  })
);

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn().mockReturnValue({
    pathname: '/test/path',
    search: '',
    hash: '',
    state: null,
  }),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {},
  }),
}));

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    paging: {
      after: 'after-id',
      before: 'before-id',
      total: 10,
    },
    handlePagingChange: jest.fn(),
    currentPage: 1,
    handlePageChange: jest.fn(),
    pageSize: 15,
    handlePageSizeChange: jest.fn(),
    showPagination: true,
    pagingCursor: {
      cursorType: undefined,
      cursorValue: undefined,
      currentPage: '1',
      pageSize: 15,
    },
  }),
}));

jest.mock(
  '../../../Settings/Services/Ingestion/IngestionListTable/IngestionListTable',
  () => {
    return function MockIngestionListTable({
      ingestionData,
      onPageChange,
    }: {
      ingestionData: IngestionPipeline[];
      onPageChange: ({
        cursorType,
        currentPage,
      }: {
        cursorType: string;
        currentPage: number;
      }) => void;
    }) {
      return (
        <div data-testid="test-suite-pipeline-tab">
          {ingestionData.map((pipeline) => (
            <div key={pipeline.id}>{pipeline.name}</div>
          ))}
          <button
            onClick={() =>
              onPageChange({ cursorType: 'after', currentPage: 2 })
            }>
            Next Page
          </button>
        </div>
      );
    };
  }
);

jest.mock(
  '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion',
  () => {
    return jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="error-placeholder-ingestion">
          Airflow not available
        </div>
      ));
  }
);

describe('TestSuite Pipeline component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getIngestionPipelines API should call on page load', async () => {
    const mockGetIngestionPipelines = getIngestionPipelines as jest.Mock;
    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    expect(mockGetIngestionPipelines).toHaveBeenCalledWith({
      arrQueryFields: ['owners', 'pipelineStatuses'],
      pipelineType: ['TestSuite'],
      testSuite: mockTestSuite?.fullyQualifiedName,
      limit: PAGE_SIZE_BASE,
    });
  });

  it('should call getIngestionPipelines with correct paging parameters', async () => {
    const mockGetIngestionPipelines = getIngestionPipelines as jest.Mock;
    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    // Initial call with default page size
    expect(mockGetIngestionPipelines).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: PAGE_SIZE_BASE,
      })
    );

    // Click next page button
    const nextPageButton = screen.getByText('Next Page');
    await act(async () => {
      nextPageButton.click();
    });

    // Verify call with after cursor
    expect(mockGetIngestionPipelines).toHaveBeenCalledWith(
      expect.objectContaining({
        paging: { after: 'after-id' },
        limit: PAGE_SIZE_BASE,
      })
    );
  });

  it('should update pipeline list when page changes', async () => {
    const updatedMockPipelines = [
      {
        id: '4',
        name: 'pipeline4',
        sourceConfig: { config: {} },
      },
    ];

    const mockGetIngestionPipelines = getIngestionPipelines as jest.Mock;
    mockGetIngestionPipelines
      .mockImplementationOnce(() =>
        Promise.resolve({ data: mockPipelines, paging: mockPaging })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: updatedMockPipelines,
          paging: { ...mockPaging, after: null },
        })
      );

    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    // Initial render should show first page pipelines
    expect(screen.getByText('pipeline1')).toBeInTheDocument();

    // Click next page button
    const nextPageButton = screen.getByText('Next Page');
    await act(async () => {
      nextPageButton.click();
    });

    // Should show second page pipeline
    expect(screen.getByText('pipeline4')).toBeInTheDocument();
  });

  it('should show error placeholder when airflow is not available', async () => {
    // Mock airflow status as unavailable
    (useAirflowStatus as jest.Mock).mockReturnValue({
      isAirflowAvailable: false,
      isFetchingStatus: false,
    });

    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    expect(
      screen.getByTestId('error-placeholder-ingestion')
    ).toBeInTheDocument();
  });

  it('should show loading state while fetching airflow status', async () => {
    // Mock airflow status as loading
    (useAirflowStatus as jest.Mock).mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: true,
    });

    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    // Component should be in loading state
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('error-placeholder-ingestion')
    ).not.toBeInTheDocument();
  });
});
