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

import { render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import React, { Fragment } from 'react';
import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import { TestCasePageTabs } from '../../../../pages/IncidentManager/IncidentManager.interface';
import { getTestCaseFailedSampleData } from '../../../../rest/testAPI';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import FailedTestCaseSampleData from './FailedTestCaseSampleData.component';

jest.mock('@openmetadata/ui-core-components', () => {
  type Col = { id: string; label?: React.ReactNode };
  type Row = Record<string, unknown> & { __rowKey: number | string };

  const TableMock = Object.assign(
    ({ children, ...rest }: React.PropsWithChildren<unknown>) => (
      <table {...rest}>{children}</table>
    ),
    {
      Header: ({
        columns,
        children,
      }: {
        columns?: Col[];
        children: (col: Col) => React.ReactNode;
      }) => (
        <thead>
          <tr>
            {columns?.map((col) => (
              <Fragment key={col.id}>{children(col)}</Fragment>
            ))}
          </tr>
        </thead>
      ),
      Head: ({ label, id }: { label?: React.ReactNode; id?: string }) => (
        <th data-testid={`head-${id}`}>{label}</th>
      ),
      Body: ({
        items,
        children,
      }: {
        items?: Row[];
        children: (item: Row) => React.ReactNode;
      }) => (
        <tbody>
          {items?.map((item) => (
            <Fragment key={String(item.__rowKey)}>{children(item)}</Fragment>
          ))}
        </tbody>
      ),
      Row: ({
        columns,
        children,
        id,
      }: {
        columns?: Col[];
        children: (col: Col) => React.ReactNode;
        id?: React.Key;
      }) => (
        <tr data-row-id={id}>
          {columns?.map((col) => (
            <Fragment key={col.id}>{children(col)}</Fragment>
          ))}
        </tr>
      ),
      Cell: ({ children }: React.PropsWithChildren<unknown>) => (
        <td>{children}</td>
      ),
    }
  );

  return {
    Table: TableMock,
    Typography: ({ children }: React.PropsWithChildren<unknown>) => (
      <span>{children}</span>
    ),
  };
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, to, ...rest }) => (
    <a data-to={typeof to === 'string' ? to : JSON.stringify(to)} {...rest}>
      {children}
    </a>
  )),
  useParams: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getTestCaseDetailPagePath: jest
    .fn()
    .mockImplementation(
      (fqn: string, tab?: string) =>
        `/test-case/${fqn}/${tab ?? 'test-case-results'}`
    ),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {},
  }),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../utils/EntityPureUtils', () => ({
  ...jest.requireActual('../../../../utils/EntityPureUtils'),
  getColumnNameFromEntityLink: jest.fn().mockReturnValue('column_x'),
}));

jest.mock('../../../../utils/EntityDisplayPureUtils', () => ({
  getEntityDeleteMessage: jest.fn().mockReturnValue('delete-message'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseFailedSampleData: jest.fn(),
  deleteTestCaseFailedSampleData: jest.fn(),
}));

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader">Loader</div>)
);

jest.mock(
  '../../../common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(() => <div>ManageButtonItemLabel</div>),
  })
);

jest.mock('../../../Database/SampleDataTable/RowData', () => ({
  RowData: jest.fn().mockImplementation(() => <div>RowData</div>),
}));

jest.mock('../../../common/DeleteModal/DeleteModal', () =>
  jest.fn().mockImplementation(() => <div>DeleteModal</div>)
);

const FQN = 'svc.db.schema.table.failing_test_case';

const mockTestCase: TestCase = {
  id: 'tc-1',
  name: 'failing_test_case',
  fullyQualifiedName: FQN,
  inspectionQuery: 'SELECT * FROM t',
  entityLink: '<#E::table::svc.db.schema.table>',
  testCaseResult: { testCaseStatus: TestCaseStatus.Failed },
} as TestCase;

describe('FailedTestCaseSampleData - observabilityRouterClassBase migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTestCaseFailedSampleData as jest.Mock).mockResolvedValue({
      columns: ['c1'],
      rows: [['r1']],
    });
  });

  it('explore-with-query Link should use observabilityRouterClassBase.getTestCaseDetailPagePath with SQL_QUERY tab', async () => {
    const { getTestCaseDetailPagePath } = jest.requireMock(
      '../../../../utils/RouterUtils'
    );

    render(<FailedTestCaseSampleData testCaseData={mockTestCase} />);

    const exploreBtn = await screen.findByTestId('explore-with-query');
    const link = exploreBtn.closest('a');

    expect(link).not.toBeNull();
    expect(link?.dataset.to).toBe(
      observabilityRouterClassBase.getTestCaseDetailPagePath(
        FQN,
        TestCasePageTabs.SQL_QUERY
      )
    );
    expect(getTestCaseDetailPagePath).toHaveBeenCalledWith(
      FQN,
      TestCasePageTabs.SQL_QUERY
    );
  });
});

describe('FailedTestCaseSampleData - fetch gating and error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTestCaseFailedSampleData as jest.Mock).mockResolvedValue({
      columns: ['c1'],
      rows: [['r1']],
    });
  });

  it('should fetch the failed-rows sample when the test case has failed', async () => {
    render(<FailedTestCaseSampleData testCaseData={mockTestCase} />);

    await waitFor(() =>
      expect(getTestCaseFailedSampleData).toHaveBeenCalledWith(mockTestCase.id)
    );
  });

  it('should not fetch the failed-rows sample when the test case is not failed', async () => {
    const passingTestCase = {
      ...mockTestCase,
      testCaseResult: { testCaseStatus: TestCaseStatus.Success },
    } as TestCase;

    render(<FailedTestCaseSampleData testCaseData={passingTestCase} />);

    await waitFor(() =>
      expect(getTestCaseFailedSampleData).not.toHaveBeenCalled()
    );
  });

  it('should not fetch when the test case has no result yet', async () => {
    const noResultTestCase = {
      ...mockTestCase,
      testCaseResult: undefined,
    } as TestCase;

    render(<FailedTestCaseSampleData testCaseData={noResultTestCase} />);

    await waitFor(() =>
      expect(getTestCaseFailedSampleData).not.toHaveBeenCalled()
    );
  });

  it('should silently ignore a 404 (no sample stored) without toasting', async () => {
    (getTestCaseFailedSampleData as jest.Mock).mockRejectedValueOnce({
      response: { status: 404 },
    } as AxiosError);

    render(<FailedTestCaseSampleData testCaseData={mockTestCase} />);

    await waitFor(() => expect(getTestCaseFailedSampleData).toHaveBeenCalled());

    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('should surface a non-404 error (e.g. 500) via a toast', async () => {
    const serverError = { response: { status: 500 } } as AxiosError;
    (getTestCaseFailedSampleData as jest.Mock).mockRejectedValueOnce(
      serverError
    );

    render(<FailedTestCaseSampleData testCaseData={mockTestCase} />);

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(serverError)
    );
  });

  it('should clear stale sample data when the status changes to non-failed', async () => {
    const { rerender } = render(
      <FailedTestCaseSampleData testCaseData={mockTestCase} />
    );

    // Sample loaded for the failing test case.
    await screen.findByTestId('explore-with-query');

    // The same mounted component now reflects a passing result.
    const passingTestCase = {
      ...mockTestCase,
      testCaseResult: { testCaseStatus: TestCaseStatus.Success },
    } as TestCase;
    rerender(<FailedTestCaseSampleData testCaseData={passingTestCase} />);

    // The previously loaded sample must not linger for the passing result.
    await waitFor(() =>
      expect(screen.queryByTestId('explore-with-query')).not.toBeInTheDocument()
    );
  });

  it('should not restore stale sample when a late response resolves after a status change', async () => {
    let resolveFetch: (value: unknown) => void = (_value) => undefined;
    (getTestCaseFailedSampleData as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { rerender } = render(
      <FailedTestCaseSampleData testCaseData={mockTestCase} />
    );

    // The failing test case's request is in flight.
    await waitFor(() =>
      expect(getTestCaseFailedSampleData).toHaveBeenCalledWith(mockTestCase.id)
    );

    // Status changes to passing before that request resolves.
    const passingTestCase = {
      ...mockTestCase,
      testCaseResult: { testCaseStatus: TestCaseStatus.Success },
    } as TestCase;
    rerender(<FailedTestCaseSampleData testCaseData={passingTestCase} />);

    // The loader must not linger while the now-ignored request is still pending.
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();

    // The in-flight request now resolves — its late response must be ignored.
    resolveFetch({ columns: ['c1'], rows: [['r1']] });

    await waitFor(() =>
      expect(screen.queryByTestId('explore-with-query')).not.toBeInTheDocument()
    );

    expect(screen.queryByTestId('explore-with-query')).not.toBeInTheDocument();
  });
});
