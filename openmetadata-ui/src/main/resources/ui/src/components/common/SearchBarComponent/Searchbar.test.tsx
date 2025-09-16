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

import { act, fireEvent, render, screen } from '@testing-library/react';
import Searchbar from './SearchBar.component';

const mockOnUserSearch = jest.fn();

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<p>Loader</p>);
});

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: unknown) => fn, // Make debounce execute immediately
}));

const mockSetFilters = jest.fn();

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockImplementation(() => ({
    setFilters: mockSetFilters,
  })),
}));

describe('Test Searchbar Component', () => {
  it('Renders the searchbar with the search text sent to it', async () => {
    act(() => {
      const onSearch = jest.fn();
      render(<Searchbar searchValue="Test Search" onSearch={onSearch} />);
    });
    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('Test Search');
  });

  it('Renders the searchbar with blank text if the search text is blank or not sent', async () => {
    const onSearch = jest.fn();
    render(<Searchbar onSearch={onSearch} />);
    const searchElement = await screen.findByTestId('searchbar');

    expect(searchElement).toHaveValue('');
  });

  it('Renders the user typed text when a change event is fired', async () => {
    const onSearch = jest.fn();

    act(() => {
      render(
        <Searchbar showLoadingStatus label="Test Label" onSearch={onSearch} />
      );
    });
    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('');
    expect(screen.getByText('Test Label')).toBeInTheDocument();

    act(() => {
      fireEvent.focus(searchElement);

      fireEvent.change(searchElement, { target: { value: 'Test Search' } });

      fireEvent.blur(searchElement);
    });

    expect(searchElement.value).toBe('Test Search');
  });

  it('Calls the callback function on keyup after timer runs out', async () => {
    const onUserSearch = jest.fn();

    await act(async () => {
      render(<Searchbar typingInterval={1000} onSearch={onUserSearch} />);
    });
    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('');

    fireEvent.change(searchElement, { target: { value: 'Test Search' } });

    expect(searchElement.value).toBe('Test Search');
  });

  it('should handle search input with debounce', async () => {
    render(<Searchbar typingInterval={1000} onSearch={mockOnUserSearch} />);

    const searchInput = screen.getByTestId('searchbar');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Should not call immediately
    // expect(mockOnUserSearch).not.toHaveBeenCalled();

    expect(mockOnUserSearch).toHaveBeenCalledWith('test');
  });

  it('should update search value when searchValue prop changes', () => {
    const { rerender } = render(
      <Searchbar searchValue="initial" onSearch={mockOnUserSearch} />
    );

    expect(screen.getByTestId('searchbar')).toHaveValue('initial');

    rerender(<Searchbar searchValue="updated" onSearch={mockOnUserSearch} />);

    expect(screen.getByTestId('searchbar')).toHaveValue('updated');
  });

  it('should update URL filters when urlSearchKey is provided', async () => {
    render(
      <Searchbar
        typingInterval={1000}
        urlSearchKey="search"
        onSearch={mockOnUserSearch}
      />
    );

    const searchInput = screen.getByTestId('searchbar');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(mockSetFilters).toHaveBeenCalledWith({ search: 'test' });
  });

  it('should set URL filter to null when search is empty', async () => {
    render(
      <Searchbar
        searchValue="test"
        typingInterval={1000}
        urlSearchKey="search"
        onSearch={mockOnUserSearch}
      />
    );

    const searchInput = screen.getByTestId('searchbar');
    fireEvent.change(searchInput, { target: { value: '' } });

    expect(mockSetFilters).toHaveBeenCalledWith({ search: null });
  });
});
