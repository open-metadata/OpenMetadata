/*
 *  Copyright 2022 Collate
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
import userEvent from '@testing-library/user-event';
import React from 'react';
import SearchDropdown from './SearchDropdown';
import { SearchDropdownProps } from './SearchDropdown.interface';

const mockOnChange = jest.fn();
const mockOnSearch = jest.fn();

const searchOptions = [
  { key: 'user.1', label: 'User 1' },
  { key: 'user.2', label: 'User 2' },
  { key: 'user.3', label: 'User 3' },
  { key: 'user.4', label: 'User 4' },
  { key: 'user.5', label: 'User 5' },
];

const mockProps: SearchDropdownProps = {
  label: 'Owner',
  options: searchOptions,
  searchKey: 'owner.name',
  selectedKeys: ['user.1'],
  showClear: true,
  onChange: mockOnChange,
  onSearch: mockOnSearch,
};

describe('Search DropDown Component', () => {
  it('Should render Dropdown components', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    expect((await screen.findByTestId('User 1')).textContent).toContain(
      'User 1'
    );
    expect((await screen.findByTestId('User 2')).textContent).toContain(
      'User 2'
    );
    expect((await screen.findByTestId('User 3')).textContent).toContain(
      'User 3'
    );
    expect((await screen.findByTestId('User 4')).textContent).toContain(
      'User 4'
    );
    expect((await screen.findByTestId('User 5')).textContent).toContain(
      'User 5'
    );

    const searchInput = await screen.findByTestId('search-input');

    expect(searchInput).toBeInTheDocument();

    const clearButton = await screen.findByTestId('clear-button');

    expect(clearButton).toBeInTheDocument();
  });

  it('Selected keys option should be checked', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    // user.1 is selected key so should be checked
    expect(await screen.findByTestId('user.1')).toBeChecked();
  });

  it('UnSelected keys option should not be checked', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    expect(await screen.findByTestId('user.2')).not.toBeChecked();
    expect(await screen.findByTestId('user.3')).not.toBeChecked();
    expect(await screen.findByTestId('user.4')).not.toBeChecked();
    expect(await screen.findByTestId('user.5')).not.toBeChecked();
  });

  it('Should render the clear all button and click should work', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const clearButton = await screen.findByTestId('clear-button');

    expect(clearButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(clearButton);
    });

    expect(mockOnChange).toHaveBeenCalledWith([], 'owner.name');
  });

  it('Should not render the clear all button if showClear is false/undefined', async () => {
    render(<SearchDropdown {...mockProps} showClear={false} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const clearButton = screen.queryByTestId('clear-button');

    expect(clearButton).not.toBeInTheDocument();
  });

  it('Search should work', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const searchInput = await screen.findByTestId('search-input');

    await act(async () => {
      userEvent.type(searchInput, 'user');
    });

    expect(searchInput).toHaveValue('user');

    expect(mockOnSearch).toHaveBeenCalledWith('user', 'owner.name');
  });

  it('On Change should work', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const option2 = await screen.findByTestId('User 2');

    await act(async () => {
      userEvent.click(option2);
    });

    // onChange should be called with previous selected keys and current selected keys
    expect(mockOnChange).toHaveBeenCalledWith(
      ['user.1', 'user.2'],
      'owner.name'
    );
  });

  it('Selected option should unselect on next click', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const option1 = await screen.findByTestId('User 1');

    await act(async () => {
      userEvent.click(option1);
    });

    expect(mockOnChange).toHaveBeenCalledWith([], 'owner.name');
  });
});
