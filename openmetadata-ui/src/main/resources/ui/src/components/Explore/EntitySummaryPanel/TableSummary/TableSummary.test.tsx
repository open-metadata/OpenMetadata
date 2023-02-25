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
import { getLatestTableProfileByFqn } from 'rest/tableAPI';
import { mockTableEntityDetails } from '../mocks/TableSummary.mock';
import TableSummary from './TableSummary.component';

jest.mock('rest/testAPI', () => ({
  getListTestCase: jest.fn().mockReturnValue([]),
}));

jest.mock('rest/tableAPI', () => ({
  getLatestTableProfileByFqn: jest
    .fn()
    .mockImplementation(() => mockTableEntityDetails),
  getTableQueryByTableId: jest
    .fn()
    .mockImplementation(() => mockTableEntityDetails),
}));

jest.mock(
  '../../../common/table-data-card-v2/TableDataCardTitle.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="TableDataCardTitle">TableDataCardTitle</div>
      ))
);

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

describe('TableSummary component tests', () => {
  it('Component should render properly', async () => {
    await act(async () => {
      render(<TableSummary entityDetails={mockTableEntityDetails} />);
    });

    const tableTitle = screen.getByTestId('TableDataCardTitle');
    const profilerHeader = screen.getByTestId('profiler-header');
    const schemaHeader = screen.getByTestId('schema-header');
    const typeLabel = screen.getByTestId('Type-label');
    const queriesLabel = screen.getByTestId('Queries-label');
    const columnsLabel = screen.getByTestId('Columns-label');
    const typeValue = screen.getByTestId('Type-value');
    const queriesValue = screen.getByTestId('Queries-value');
    const columnsValue = screen.getByTestId('Columns-value');
    const noProfilerPlaceholder = screen.getByTestId(
      'no-profiler-enabled-message'
    );
    const summaryList = screen.getByTestId('SummaryList');

    expect(tableTitle).toBeInTheDocument();
    expect(profilerHeader).toBeInTheDocument();
    expect(schemaHeader).toBeInTheDocument();
    expect(typeLabel).toBeInTheDocument();
    expect(queriesLabel).toBeInTheDocument();
    expect(columnsLabel).toBeInTheDocument();
    expect(typeValue).toContainHTML('Regular');
    expect(queriesValue).toContainHTML('2');
    expect(columnsValue).toContainHTML('2');
    expect(noProfilerPlaceholder).toContainHTML(
      'message.no-profiler-enabled-summary-message'
    );
    expect(summaryList).toBeInTheDocument();
  });

  it('Profiler data should be displayed for tables with profiler data available', async () => {
    (getLatestTableProfileByFqn as jest.Mock).mockImplementationOnce(() => ({
      ...mockTableEntityDetails,
      profile: { rowCount: 30, columnCount: 2, timestamp: 38478857 },
    }));

    await act(async () => {
      render(<TableSummary entityDetails={mockTableEntityDetails} />);
    });

    const rowCountLabel = screen.getByTestId('label.entity-count-label');
    const colCountLabel = screen.getByTestId('label.column-entity-label');
    const tableSampleLabel = screen.getByTestId(
      'label.table-entity-text %-label'
    );
    const testsPassedLabel = screen.getByTestId(
      'label.test-plural label.passed-label'
    );
    const testsAbortedLabel = screen.getByTestId(
      'label.test-plural label.aborted-label'
    );
    const testsFailedLabel = screen.getByTestId(
      'label.test-plural label.failed-label'
    );
    const rowCountValue = screen.getByTestId('label.entity-count-value');
    const colCountValue = screen.getByTestId('label.column-entity-value');
    const tableSampleValue = screen.getByTestId(
      'label.table-entity-text %-value'
    );
    const testsPassedValue = screen.getByTestId(
      'label.test-plural label.passed-value'
    );
    const testsAbortedValue = screen.getByTestId(
      'label.test-plural label.aborted-value'
    );
    const testsFailedValue = screen.getByTestId(
      'label.test-plural label.failed-value'
    );

    expect(rowCountLabel).toBeInTheDocument();
    expect(colCountLabel).toBeInTheDocument();
    expect(tableSampleLabel).toBeInTheDocument();
    expect(testsPassedLabel).toBeInTheDocument();
    expect(testsAbortedLabel).toBeInTheDocument();
    expect(testsFailedLabel).toBeInTheDocument();
    expect(rowCountValue).toContainHTML('30');
    expect(colCountValue).toContainHTML('2');
    expect(tableSampleValue).toContainHTML('100%');
    expect(testsPassedValue).toContainHTML('00');
    expect(testsAbortedValue).toContainHTML('00');
    expect(testsFailedValue).toContainHTML('00');
  });
});
