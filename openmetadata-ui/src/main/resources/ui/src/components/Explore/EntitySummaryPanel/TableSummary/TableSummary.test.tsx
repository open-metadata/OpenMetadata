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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_TABLE } from '../../../../mocks/TableData.mock';
import {
  getLatestTableProfileByFqn,
  getTableDetailsByFQN,
} from '../../../../rest/tableAPI';
import { DRAWER_NAVIGATION_OPTIONS } from '../../../../utils/EntityUtils';
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
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
}));

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockReturnValue({ pathname: '/table' }),
}));

jest.mock('../../../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest
      .fn()
      .mockImplementation(() => mockEntityPermissions),
  })),
}));

describe('TableSummary component tests', () => {
  it('Component should render properly, when loaded in the Explore page.', async () => {
    await act(async () => {
      render(<TableSummary entityDetails={mockTableEntityDetails} />);
    });

    const profilerHeader = screen.getByTestId('profiler-header');
    const schemaHeader = screen.getByTestId('schema-header');
    const tagsHeader = screen.getByTestId('tags-header');
    const typeLabel = screen.getByTestId('label.type-label');
    const queriesLabel = screen.getByTestId('label.query-plural-label');
    const columnsLabel = screen.getByTestId('label.column-plural-label');
    const typeValue = screen.getByTestId('label.type-value');
    const columnsValue = screen.getByTestId('label.column-plural-value');
    const noProfilerPlaceholder = screen.getByTestId(
      'no-profiler-enabled-message'
    );
    const summaryList = screen.getByTestId('SummaryList');

    expect(profilerHeader).toBeInTheDocument();
    expect(schemaHeader).toBeInTheDocument();
    expect(tagsHeader).toBeInTheDocument();
    expect(typeLabel).toBeInTheDocument();
    expect(queriesLabel).toBeInTheDocument();
    expect(columnsLabel).toBeInTheDocument();
    expect(typeValue).toContainHTML('Regular');
    expect(columnsValue).toContainHTML('2');
    expect(noProfilerPlaceholder).toContainHTML(
      'message.no-profiler-enabled-summary-message'
    );
    expect(summaryList).toBeInTheDocument();
  });

  it('Component should render properly, when loaded in the Lineage page.', async () => {
    const labels = [
      'label.service-label',
      'label.type-label',
      'label.database-label',
      'label.schema-label',
      'label.query-plural-label',
      'label.column-plural-label',
    ];

    const values = [
      'label.type-value',
      'label.service-value',
      'label.database-value',
      'label.schema-value',
    ];
    await act(async () => {
      render(
        <TableSummary
          componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
          entityDetails={mockTableEntityDetails}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const profilerHeader = screen.getByTestId('profiler-header');
    const schemaHeader = screen.getAllByTestId('schema-header');
    const queriesLabel = screen.getByTestId('label.query-plural-label');
    const columnsLabel = screen.getByTestId('label.column-plural-label');
    const typeValue = screen.getByTestId('label.type-value');
    const columnsValue = screen.getByTestId('label.column-plural-value');
    const noProfilerPlaceholder = screen.getByTestId(
      'no-profiler-enabled-message'
    );
    const ownerLabel = screen.queryByTestId('label.owner-label');

    const summaryList = screen.getByTestId('SummaryList');

    expect(ownerLabel).not.toBeInTheDocument();

    labels.forEach((label) =>
      expect(screen.getByTestId(label)).toBeInTheDocument()
    );
    values.forEach((value) =>
      expect(screen.getByTestId(value)).toBeInTheDocument()
    );

    expect(profilerHeader).toBeInTheDocument();
    expect(schemaHeader[0]).toBeInTheDocument();
    expect(queriesLabel).toBeInTheDocument();
    expect(columnsLabel).toBeInTheDocument();
    expect(typeValue).toContainHTML('Regular');
    expect(columnsValue).toContainHTML('2');
    expect(noProfilerPlaceholder).toContainHTML(
      'message.no-profiler-enabled-summary-message'
    );
    expect(summaryList).toBeInTheDocument();
  });

  it('Profiler data should be displayed for tables with profiler data available', async () => {
    (getLatestTableProfileByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...mockTableEntityDetails,
        profile: { rowCount: 30, columnCount: 2, timestamp: 38478857 },
      })
    );

    await act(async () => {
      render(<TableSummary entityDetails={mockTableEntityDetails} />);
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
    expect(testsPassedValue.textContent).toBe('00');
    expect(testsAbortedValue.textContent).toBe('00');
    expect(testsFailedValue.textContent).toBe('00');
  });

  it('column test case count should appear', async () => {
    (getLatestTableProfileByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...mockTableEntityDetails,
        profile: { rowCount: 30, timestamp: 38478857 },
      })
    );
    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ...MOCK_TABLE,
        testSuite: {
          summary: {
            success: 3,
            failed: 1,
            aborted: 1,
          },
        },
      })
    );
    await act(async () => {
      render(<TableSummary entityDetails={mockTableEntityDetails} />);
    });
    const testsPassedValue = screen.getByTestId('test-passed-value');
    const testsAbortedValue = screen.getByTestId('test-aborted-value');
    const testsFailedValue = screen.getByTestId('test-failed-value');

    expect(testsPassedValue.textContent).toBe('03');
    expect(testsAbortedValue.textContent).toBe('01');
    expect(testsFailedValue.textContent).toBe('01');
  });
});
