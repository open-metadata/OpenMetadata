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

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import { mockTableEntityDetails } from '../mocks/TableSummary.mock';
import TableSummary from './TableSummary.component';

const mockEntityPermissions = {
  Create: true,
  Delete: true,
  ViewAll: true,
  ViewBasic: true,
  ViewDataProfile: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

jest.mock('../../../../rest/testAPI', () => ({
  getListTestCase: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../rest/tableAPI', () => ({
  getLatestTableProfileByFqn: jest
    .fn()
    .mockImplementation(() => mockTableEntityDetails),
}));
jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn(),
  TestCaseType: {
    all: 'all',
    table: 'table',
    column: 'column',
  },
}));

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

jest.mock(
  '../../../common/SummaryTagsDescription/SummaryTagsDescription.component',
  () => jest.fn().mockImplementation(() => <p>SummaryTagsDescription</p>)
);

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '/table' }));
});

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest
      .fn()
      .mockImplementation(() => mockEntityPermissions),
  })),
}));

describe('TableSummary component tests', () => {
  it('Component should render properly, when loaded in the Explore page.', async () => {
    await act(async () => {
      render(
        <TableSummary
          entityDetails={mockTableEntityDetails}
          permissions={mockEntityPermissions as OperationPermission}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const profilerHeader = screen.getByTestId('profiler-header');

    const noProfilerPlaceholder = screen.getByTestId(
      'no-profiler-enabled-message'
    );

    expect(profilerHeader).toBeInTheDocument();

    expect(noProfilerPlaceholder).toContainHTML(
      'message.no-data-quality-enabled-summary-message'
    );
  });

  it('Component should render properly, when loaded in the Lineage page.', async () => {
    await act(async () => {
      render(
        <TableSummary
          entityDetails={mockTableEntityDetails}
          permissions={mockEntityPermissions as OperationPermission}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const profilerHeader = screen.getByTestId('profiler-header');

    const noProfilerPlaceholder = screen.getByTestId(
      'no-profiler-enabled-message'
    );

    expect(profilerHeader).toBeInTheDocument();

    expect(noProfilerPlaceholder).toContainHTML(
      'message.no-data-quality-enabled-summary-message'
    );
  });

  it('Profiler data should be displayed for tables with profiler data available', async () => {
    (getTestCaseExecutionSummary as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        success: 0,
        failed: 0,
        aborted: 0,
      })
    );

    await act(async () => {
      render(
        <TableSummary
          entityDetails={mockTableEntityDetails}
          permissions={mockEntityPermissions as OperationPermission}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const testsPassedLabel = screen.getByTestId('test-passed');
    const testsAbortedLabel = screen.getByTestId('test-aborted');
    const testsFailedLabel = screen.getByTestId('test-failed');
    const testsPassedValue = screen.getByTestId('test-passed-value');
    const testsAbortedValue = screen.getByTestId('test-aborted-value');
    const testsFailedValue = screen.getByTestId('test-failed-value');

    expect(testsPassedLabel).toBeInTheDocument();
    expect(testsAbortedLabel).toBeInTheDocument();
    expect(testsFailedLabel).toBeInTheDocument();
    expect(testsPassedValue.textContent).toBe('0');
    expect(testsAbortedValue.textContent).toBe('0');
    expect(testsFailedValue.textContent).toBe('0');
  });

  it('column test case count should appear', async () => {
    (getTestCaseExecutionSummary as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        success: 3,
        failed: 1,
        aborted: 1,
      })
    );
    await act(async () => {
      render(
        <TableSummary
          entityDetails={mockTableEntityDetails}
          permissions={mockEntityPermissions as OperationPermission}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });
    const testsPassedValue = screen.getByTestId('test-passed-value');
    const testsAbortedValue = screen.getByTestId('test-aborted-value');
    const testsFailedValue = screen.getByTestId('test-failed-value');

    expect(testsPassedValue.textContent).toBe('3');
    expect(testsAbortedValue.textContent).toBe('1');
    expect(testsFailedValue.textContent).toBe('1');
  });
});
