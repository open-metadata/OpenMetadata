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
import { getLatestTableProfileByFqn } from 'rest/tableAPI';
import { DRAWER_NAVIGATION_OPTIONS } from 'utils/EntityUtils';
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

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

describe('TableSummary component tests', () => {
  it('Component should render properly, when loaded in the Explore page.', async () => {
    await act(async () => {
      render(<TableSummary entityDetails={mockTableEntityDetails} />);
    });

    const profilerHeader = screen.getByTestId('profiler-header');
    const schemaHeader = screen.getByTestId('schema-header');
    const typeLabel = screen.getByTestId('label.type-label');
    const queriesLabel = screen.getByTestId('label.query-plural-label');
    const columnsLabel = screen.getByTestId('label.column-plural-label');
    const typeValue = screen.getByTestId('label.type-value');
    const queriesValue = screen.getByTestId('label.query-plural-value');
    const columnsValue = screen.getByTestId('label.column-plural-value');
    const noProfilerPlaceholder = screen.getByTestId(
      'no-profiler-enabled-message'
    );
    const summaryList = screen.getByTestId('SummaryList');

    expect(profilerHeader).toBeInTheDocument();
    expect(schemaHeader).toBeInTheDocument();
    expect(typeLabel).toBeInTheDocument();
    expect(queriesLabel).toBeInTheDocument();
    expect(columnsLabel).toBeInTheDocument();
    expect(typeValue).toContainHTML('Regular');
    expect(queriesValue.textContent).toBe('2 past week');
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
    render(
      <TableSummary
        componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
        entityDetails={mockTableEntityDetails}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const profilerHeader = screen.getByTestId('profiler-header');
    const schemaHeader = screen.getAllByTestId('schema-header');
    const queriesLabel = screen.getByTestId('label.query-plural-label');
    const columnsLabel = screen.getByTestId('label.column-plural-label');
    const typeValue = screen.getByTestId('label.type-value');
    const queriesValue = screen.getByTestId('label.query-plural-value');
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
    expect(queriesValue.textContent).toBe('2 past week');
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
