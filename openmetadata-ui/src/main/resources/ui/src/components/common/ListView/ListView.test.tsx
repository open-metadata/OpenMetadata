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
import { pagingObject } from '../../../constants/constants';
import { CursorType } from '../../../enums/pagination.enum';
import { PagingHandlerParams } from '../NextPrevious/NextPrevious.interface';
import { ListView } from './ListView.component';

const mockCardRenderer = jest.fn().mockImplementation(() => <>Card</>);
const mockOnSearch = jest.fn();
const mockHandleDeletedSwitchChange = jest.fn();

jest.mock('../Table/Table', () => {
  return jest.fn(() => <p>Table</p>);
});

jest.mock('../SearchBarComponent/SearchBar.component', () => {
  return jest.fn().mockImplementation(() => <p>Searchbar</p>);
});

jest.mock('../NextPrevious/NextPrevious', () => {
  return ({
    pagingHandler,
  }: {
    pagingHandler: ({ cursorType, currentPage }: PagingHandlerParams) => void;
  }) => (
    <div data-testid="next-previous-container">
      NextPrevious
      <button
        data-testid="next-previous-button"
        onClick={() =>
          pagingHandler({
            currentPage: 0,
            cursorType: CursorType.AFTER,
          })
        }>
        NextPrevious
      </button>
    </div>
  );
});

const mockPagingHandler = jest.fn();
const mockOnShowSizeChange = jest.fn();

const mockCustomPaginationProps = {
  showPagination: true,
  currentPage: 0,
  isLoading: false,
  isNumberBased: false,
  pageSize: 10,
  paging: pagingObject,
  pagingHandler: mockPagingHandler,
  onShowSizeChange: mockOnShowSizeChange,
};

describe('ListView component', () => {
  it('should render toggle button for card and table', async () => {
    render(
      <ListView
        cardRenderer={mockCardRenderer}
        customPaginationProps={mockCustomPaginationProps}
        deleted={false}
        handleDeletedSwitchChange={mockHandleDeletedSwitchChange}
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableProps={{
          columns: [],
          dataSource: [],
        }}
      />
    );

    expect(await screen.findByText('Searchbar')).toBeInTheDocument();
    expect(await screen.findByTestId('grid')).toBeInTheDocument();
    expect(await screen.findByTestId('list')).toBeInTheDocument();
  });

  it('should render table by default', async () => {
    render(
      <ListView
        cardRenderer={mockCardRenderer}
        customPaginationProps={mockCustomPaginationProps}
        deleted={false}
        handleDeletedSwitchChange={mockHandleDeletedSwitchChange}
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableProps={{
          columns: [],
          dataSource: [],
        }}
      />
    );

    expect(await screen.findByText('Table')).toBeInTheDocument();
  });

  it('should render card when card is selected', async () => {
    render(
      <ListView
        cardRenderer={mockCardRenderer}
        customPaginationProps={mockCustomPaginationProps}
        deleted={false}
        handleDeletedSwitchChange={mockHandleDeletedSwitchChange}
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableProps={{
          columns: [],
          dataSource: [{ name: 'test' }],
        }}
      />
    );
    await act(async () => {
      fireEvent.click(await screen.findByTestId('grid'));
    });

    expect(mockCardRenderer).toHaveBeenCalledWith({ name: 'test' });

    expect(await screen.findByText('Card')).toBeInTheDocument();
  });

  it('should call handleDeletedSwitchChange after switch toggle', async () => {
    render(
      <ListView
        cardRenderer={mockCardRenderer}
        customPaginationProps={mockCustomPaginationProps}
        deleted={false}
        handleDeletedSwitchChange={mockHandleDeletedSwitchChange}
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableProps={{
          columns: [],
          dataSource: [{ name: 'test' }],
        }}
      />
    );

    expect(mockHandleDeletedSwitchChange).toHaveBeenCalledTimes(0);

    await act(async () => {
      fireEvent.click(await screen.findByTestId('show-deleted-switch'));
    });

    expect(mockHandleDeletedSwitchChange).toHaveBeenCalledTimes(1);
  });

  it('should call pagingHandler in ListView', async () => {
    render(
      <ListView
        cardRenderer={mockCardRenderer}
        customPaginationProps={mockCustomPaginationProps}
        deleted={false}
        handleDeletedSwitchChange={mockHandleDeletedSwitchChange}
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableProps={{
          columns: [],
          dataSource: [{ name: 'test' }],
        }}
      />
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId('grid'));
    });

    await act(async () => {
      fireEvent.click(await screen.findByTestId('next-previous-button'));
    });

    expect(mockPagingHandler).toHaveBeenCalledWith({
      currentPage: 0,
      cursorType: CursorType.AFTER,
    });
  });

  it('should not  visible pagination in TableView', async () => {
    render(
      <ListView
        cardRenderer={mockCardRenderer}
        customPaginationProps={mockCustomPaginationProps}
        deleted={false}
        handleDeletedSwitchChange={mockHandleDeletedSwitchChange}
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableProps={{
          columns: [],
          dataSource: [{ name: 'test' }],
        }}
      />
    );

    expect(
      screen.queryByTestId('next-previous-button')
    ).not.toBeInTheDocument();
  });
});
