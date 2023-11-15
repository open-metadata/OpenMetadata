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
import { ListView } from './ListView.component';

const mockCardRenderer = jest.fn().mockImplementation(() => <>Card</>);
const mockOnSearch = jest.fn();

jest.mock('../../components/common/Table/Table', () => {
  return jest.fn(() => <p>Table</p>);
});

jest.mock('../../components/common/searchbar/Searchbar', () => {
  return jest.fn().mockImplementation(() => <p>Searchbar</p>);
});

describe('ListView component', () => {
  it('should render toggle button for card and table', async () => {
    render(
      <ListView
        cardRenderer={mockCardRenderer}
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableprops={{
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
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableprops={{
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
        searchProps={{
          onSearch: mockOnSearch,
        }}
        tableprops={{
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
});
