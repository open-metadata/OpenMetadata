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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
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
} as unknown as Table['testSuite'];

const mockPipelines = [
  {
    id: '1',
    name: 'pipeline1',
    fullyQualifiedName: 'svc.pipeline1',
    sourceConfig: {
      config: {
        testCases: ['test1', 'test2', 'test3'],
      },
    },
  },
  {
    id: '2',
    name: 'pipeline2',
    fullyQualifiedName: 'svc.pipeline2',
    sourceConfig: {
      config: {
        testCases: ['test1'],
      },
    },
  },
  {
    id: '3',
    name: 'pipeline3',
    fullyQualifiedName: 'svc.pipeline3',
    sourceConfig: {
      config: {},
    },
  },
] as unknown as IngestionPipeline[];

const mockPaging = {
  after: 'after-id',
  before: 'before-id',
  total: 10,
};

jest.mock('@openmetadata/ui-core-components', () => {
  const MockTable = ({
    children,
    'data-testid': testId,
  }: React.PropsWithChildren<{
    'data-testid'?: string;
    [key: string]: unknown;
  }>) => <table data-testid={testId}>{children}</table>;

  MockTable.Header = ({
    columns,
    children,
  }: {
    columns: Array<{
      id: string;
      name: React.ReactNode;
      headerContent?: React.ReactNode;
    }>;
    children: (col: {
      id: string;
      name: React.ReactNode;
      headerContent?: React.ReactNode;
    }) => React.ReactNode;
  }) => (
    <thead>
      <tr>{(columns || []).map((col) => children(col as never))}</tr>
    </thead>
  );

  MockTable.Head = ({
    children,
    className,
    id,
    label,
  }: {
    children?: React.ReactNode;
    className?: string;
    id?: string;
    label?: React.ReactNode;
  }) => (
    <th className={className} id={id}>
      {label}
      {children}
    </th>
  );

  MockTable.Body = ({
    items,
    children,
    renderEmptyState,
  }: {
    items?: unknown[];
    children: (item: unknown) => React.ReactNode;
    renderEmptyState?: () => React.ReactNode;
  }) => (
    <tbody>
      {items && items.length > 0
        ? items.map((item) => children(item))
        : renderEmptyState?.()}
    </tbody>
  );

  MockTable.Row = ({
    children,
    id,
  }: React.PropsWithChildren<{ id?: string }>) => <tr id={id}>{children}</tr>;

  MockTable.Cell = ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <td className={className}>{children}</td>
  );

  const MockTableCard = {
    Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  };

  const MockTooltip = ({ children }: React.PropsWithChildren) => (
    <>{children}</>
  );

  const MockTooltipTrigger = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span {...props}>{children}</span>
  );

  return {
    Table: MockTable,
    TableCard: MockTableCard,
    Tooltip: MockTooltip,
    TooltipTrigger: MockTooltipTrigger,
  };
});

jest.mock('../../../../rest/ingestionPipelineAPI', () => {
  return {
    deleteIngestionPipelineById: jest.fn(),
    deployIngestionPipelineById: jest.fn(),
    enableDisableIngestionPipelineById: jest.fn(),
    getIngestionPipelines: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: mockPipelines, paging: mockPaging })
      ),
    getRunHistoryForPipeline: jest.fn().mockResolvedValue({ data: [] }),
    triggerIngestionPipelineById: jest.fn(),
  };
});

jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'active',
    }),
  })
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {},
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      Delete: true,
      EditAll: true,
      EditIngestionPipelineStatus: true,
    }),
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
  }),
}));

jest.mock('../../../common/NextPrevious/NextPrevious', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ pagingHandler }) => (
      <button
        onClick={() => pagingHandler({ cursorType: 'after', currentPage: 2 })}>
        Next Page
      </button>
    )),
}));

jest.mock(
  '../../../Settings/Services/Ingestion/IngestionRecentRun/IngestionRecentRuns.component',
  () => ({
    IngestionRecentRuns: jest
      .fn()
      .mockImplementation(() => <div>IngestionRecentRuns</div>),
  })
);

jest.mock(
  '../../../Settings/Services/Ingestion/IngestionListTable/PipelineActions/PipelineActions',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="pipeline-actions">PipelineActions</div>
      ))
);

jest.mock(
  '../../../Settings/Services/Ingestion/IngestionListTable/IngestionStatusCount/IngestionStatusCount',
  () => jest.fn().mockImplementation(() => <div>IngestionStatusCount</div>)
);

jest.mock('../../../Modals/EntityDeleteModal/EntityDeleteModal', () =>
  jest.fn().mockImplementation(() => null)
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
    (useAirflowStatus as jest.Mock).mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'active',
    });
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
      paging: undefined,
    });
  });

  it('should call getIngestionPipelines with correct paging parameters', async () => {
    const mockGetIngestionPipelines = getIngestionPipelines as jest.Mock;
    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    const nextPageButton = screen.getByText('Next Page');
    await act(async () => {
      fireEvent.click(nextPageButton);
    });

    expect(mockGetIngestionPipelines).toHaveBeenCalledWith(
      expect.objectContaining({
        paging: { after: 'after-id' },
        limit: PAGE_SIZE_BASE,
      })
    );
  });

  it('should render pipeline rows', async () => {
    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    expect(screen.getByText('pipeline1')).toBeInTheDocument();
    expect(screen.getByText('pipeline2')).toBeInTheDocument();
  });

  it('should show error placeholder when airflow is not available', async () => {
    (useAirflowStatus as jest.Mock).mockReturnValue({
      isAirflowAvailable: false,
      isFetchingStatus: false,
      platform: 'active',
    });

    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    expect(
      screen.getByTestId('error-placeholder-ingestion')
    ).toBeInTheDocument();
  });

  it('should display test case count for each pipeline', async () => {
    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    expect(screen.getByTestId('test-case-count-pipeline1')).toHaveTextContent(
      '3'
    );
    expect(screen.getByTestId('test-case-count-pipeline2')).toHaveTextContent(
      '1'
    );
    expect(screen.getByTestId('test-case-count-pipeline3')).toHaveTextContent(
      'label.all'
    );
  });

  it('should render test cases column header with label and helper icon', async () => {
    await act(async () => {
      render(<TestSuitePipelineTab testSuite={mockTestSuite} />);
    });

    expect(screen.getByText('label.test-case-plural')).toBeInTheDocument();
    expect(
      screen.getByTestId('test-cases-info-tooltip-trigger')
    ).toBeInTheDocument();
    expect(screen.getByTestId('test-cases-info-tooltip-icon')).toHaveClass(
      'tw:size-3'
    );
  });
});
