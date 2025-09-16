/*
 *  Copyright 2022 Collate.
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
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_TABLE } from '../../../../../mocks/TableData.mock';
import ColumnProfileTable from './ColumnProfileTable';

jest.mock('../../../../common/Table/Table', () =>
  jest.fn().mockImplementation(({ searchProps }) => (
    <div>
      <input data-testid="searchbar" value={searchProps?.searchValue} />
      <div>Table</div>
    </div>
  ))
);
jest.mock('../../../../PageHeader/PageHeader.component', () =>
  jest.fn().mockImplementation(() => <div>PageHeader</div>)
);
jest.mock('../../../../common/DatePickerMenu/DatePickerMenu.component', () =>
  jest.fn().mockImplementation(() => <div>DatePickerMenu</div>)
);
jest.mock('../ColumnPickerMenu', () =>
  jest.fn().mockImplementation(() => <div>ColumnPickerMenu</div>)
);
jest.mock('../ColumnSummary', () =>
  jest.fn().mockImplementation(() => <div>ColumnSummary</div>)
);
jest.mock('../../../../common/SummaryCard/SummaryCard.component', () => ({
  SummaryCard: jest.fn().mockImplementation(() => <div>SummaryCard</div>),
}));

jest.mock('../../../../../utils/CommonUtils', () => ({
  formatNumberWithComma: jest.fn(),
  getTableFQNFromColumnFQN: jest.fn().mockImplementation((fqn) => fqn),
}));
jest.mock('../../../../common/SearchBarComponent/SearchBar.component', () => {
  return jest
    .fn()
    .mockImplementation(({ searchValue, onSearch }) => (
      <input
        data-testid="searchbar"
        value={searchValue}
        onChange={(e) => onSearch(e.target.value)}
      />
    ));
});
jest.mock('../ProfilerProgressWidget/ProfilerProgressWidget', () => {
  return jest.fn().mockImplementation(({ value }) => (
    <span data-testid="profiler-progress-widget">
      {value} <span>Progress bar</span>{' '}
    </span>
  ));
});
jest.mock('../../../../common/TestIndicator/TestIndicator', () => {
  return jest.fn().mockImplementation(({ value, type }) => (
    <span data-testid="test-indicator">
      {value} <span>{type}</span>
    </span>
  ));
});
jest.mock('../TableProfilerProvider', () => ({
  useTableProfiler: jest.fn().mockImplementation(() => ({
    tableProfiler: MOCK_TABLE,
    permissions: {
      EditAll: true,
      EditTests: true,
      EditDataProfile: true,
      ViewDataProfile: true,
      ViewAll: true,
    },
  })),
}));

describe('Test ColumnProfileTable component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    render(<ColumnProfileTable />, {
      wrapper: MemoryRouter,
    });

    const container = await screen.findByTestId(
      'column-profile-table-container'
    );
    const searchbox = await screen.findByTestId('searchbar');

    expect(searchbox).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it('should render without crashing even if column is undefined', async () => {
    render(<ColumnProfileTable />, {
      wrapper: MemoryRouter,
    });

    const container = await screen.findByTestId(
      'column-profile-table-container'
    );
    const searchbox = await screen.findByTestId('searchbar');

    expect(searchbox).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it('search box should work as expected', async () => {
    render(<ColumnProfileTable />, {
      wrapper: MemoryRouter,
    });

    const searchbox = await screen.findByTestId('searchbar');

    expect(searchbox).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(searchbox, { target: { value: 'test' } });
    });

    expect(searchbox).toHaveValue('test');

    await act(async () => {
      fireEvent.change(searchbox, { target: { value: '' } });
    });

    expect(searchbox).toHaveValue('');
  });
});
