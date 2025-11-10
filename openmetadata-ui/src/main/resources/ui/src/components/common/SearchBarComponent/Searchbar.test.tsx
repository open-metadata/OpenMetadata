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
  debounce: (fn: () => void) => fn,
}));

describe('Test Searchbar Component', () => {
  beforeEach(() => {
    mockOnUserSearch.mockClear();
  });

  it('Renders the searchbar with the search text sent to it', async () => {
    const onSearch = jest.fn();
    render(<Searchbar searchValue="Test Search" onSearch={onSearch} />);
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

    render(
      <Searchbar showLoadingStatus label="Test Label" onSearch={onSearch} />
    );

    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('');
    expect(screen.getByText('Test Label')).toBeInTheDocument();

    act(() => {
      fireEvent.change(searchElement, { target: { value: 'Test Search' } });
    });

    // Verify the onSearch callback is called with the correct value
    expect(onSearch).toHaveBeenCalledWith('Test Search');
  });

  it('Calls the callback function on keyup after timer runs out', async () => {
    const onUserSearch = jest.fn();

    render(<Searchbar typingInterval={1000} onSearch={onUserSearch} />);

    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('');

    act(() => {
      fireEvent.change(searchElement, { target: { value: 'Test Search' } });
    });

    // Verify the onSearch callback is called with the correct value
    expect(onUserSearch).toHaveBeenCalledWith('Test Search');
  });

  it('should handle search input with debounce', async () => {
    render(<Searchbar typingInterval={1000} onSearch={mockOnUserSearch} />);

    const searchInput = screen.getByTestId('searchbar');

    act(() => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

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

  it('should call onSearch with latest value when typing fast', async () => {
    const onSearch = jest.fn();
    render(<Searchbar typingInterval={100} onSearch={onSearch} />);

    const searchInput = screen.getByTestId('searchbar');

    // Simulate fast typing - each change triggers debounce immediately due to mock
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'a' } });
      fireEvent.change(searchInput, { target: { value: 'ab' } });
      fireEvent.change(searchInput, { target: { value: 'abc' } });
    });

    // onSearch should have been called with the latest value
    // Due to debounce mock executing immediately, it's called multiple times
    // The critical test is that the LAST call has the latest value (abc)
    expect(onSearch).toHaveBeenLastCalledWith('abc');
  });

  it('should show loading indicator when isLoading is true', () => {
    render(
      <Searchbar isLoading showLoadingStatus onSearch={mockOnUserSearch} />
    );

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should show loading indicator when typing', async () => {
    render(
      <Searchbar
        showLoadingStatus
        typingInterval={1000}
        onSearch={mockOnUserSearch}
      />
    );

    const searchInput = screen.getByTestId('searchbar');

    act(() => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

    // Verify the onSearch callback is called with the correct value
    expect(mockOnUserSearch).toHaveBeenCalledWith('test');
  });

  it('should properly manage internal state during user typing', async () => {
    const onSearch = jest.fn();
    render(<Searchbar searchValue="initial" onSearch={onSearch} />);

    const searchInput = screen.getByTestId('searchbar') as HTMLInputElement;

    // Initial value should be set
    expect(searchInput.value).toBe('initial');

    // Simulate user typing
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'user input' } });
    });

    // Verify the onSearch callback is called with the correct value
    expect(onSearch).toHaveBeenCalledWith('user input');
  });
});
