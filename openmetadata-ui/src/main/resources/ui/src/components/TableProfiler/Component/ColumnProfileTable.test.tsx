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
import { ColumnsType } from 'antd/lib/table';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Column, ColumnProfile } from '../../../generated/entity/data/table';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import { ColumnProfileTableProps } from '../TableProfiler.interface';
import ColumnProfileTable from './ColumnProfileTable';

jest.mock('antd', () => ({
  Typography: {
    Text: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  },
  Button: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <button {...props}>{children}</button>
    )),

  Space: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Tooltip: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Table: jest.fn().mockImplementation(({ columns, dataSource }) => (
    <table>
      <thead>
        <tr>
          {(columns as ColumnsType<ColumnProfile>).map((col) => (
            <th key={col.key}>{col.title}</th>
          ))}
        </tr>
      </thead>
      <tbody key="tbody">
        {dataSource.map((row: any, i: number) => (
          <tr key={i}>
            {columns.map((col: any) => (
              <td key={col.key}>
                {col.render
                  ? col.render(row[col.dataIndex], col)
                  : row[col.dataIndex]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  formatNumberWithComma: jest.fn(),
}));
jest.mock('../../common/searchbar/Searchbar', () => {
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
jest.mock('./ProfilerProgressWidget', () => {
  return jest.fn().mockImplementation(({ value }) => (
    <span data-testid="profiler-progress-widget">
      {value} <span>Progress bar</span>{' '}
    </span>
  ));
});
jest.mock('../../common/TestIndicator/TestIndicator', () => {
  return jest.fn().mockImplementation(({ value, type }) => (
    <span data-testid="test-indicator">
      {value} <span>{type}</span>
    </span>
  ));
});
jest.mock('../../../utils/DatasetDetailsUtils');

const mockProps: ColumnProfileTableProps = {
  columns: MOCK_TABLE.columns,
  columnTests: [],
  hasEditAccess: true,
};

describe('Test ColumnProfileTable component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    render(<ColumnProfileTable {...mockProps} />, {
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
    render(
      <ColumnProfileTable
        {...mockProps}
        columns={undefined as unknown as Column[]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const container = await screen.findByTestId(
      'column-profile-table-container'
    );
    const searchbox = await screen.findByTestId('searchbar');

    expect(searchbox).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it('search box should work as expected', async () => {
    render(<ColumnProfileTable {...mockProps} />, {
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
