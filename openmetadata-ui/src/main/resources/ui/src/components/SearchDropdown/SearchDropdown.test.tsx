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

const searchOptions = ['User 1', 'User 2', 'User 3', 'User 4', 'User 5'];

const mockProps: SearchDropdownProps = {
  label: 'Owner',
  isSuggestionsLoading: false,
  options: searchOptions,
  searchKey: 'owner.name',
  selectedKeys: ['User 1'],
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

    const clearButton = screen.queryByTestId('clear-button');

    expect(clearButton).not.toBeInTheDocument();

    const updateButton = await screen.findByTestId('update-btn');
    const closeButton = await screen.findByTestId('update-btn');

    expect(updateButton).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();
  });

  it('Selected keys option should be checked', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    // User 1 is selected key so should be checked
    expect(await screen.findByTestId('User 1-checkbox')).toBeChecked();
  });

  it('UnSelected keys option should not be checked', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    expect(await screen.findByTestId('User 2-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 3-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 4-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 5-checkbox')).not.toBeChecked();
  });

  it('Should render the clear all button after more than one options are selected and click should work', async () => {
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

    let option1Checkbox = await screen.findByTestId('User 1-checkbox');
    let option2Checkbox = await screen.findByTestId('User 2-checkbox');

    expect(option1Checkbox).toBeChecked();
    expect(option2Checkbox).toBeChecked();

    const clearButton = await screen.findByTestId('clear-button');

    expect(clearButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(clearButton);
    });

    option1Checkbox = await screen.findByTestId('User 1-checkbox');
    option2Checkbox = await screen.findByTestId('User 2-checkbox');

    expect(option1Checkbox).not.toBeChecked();
    expect(option2Checkbox).not.toBeChecked();
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

  it('Update button should work properly', async () => {
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

    const updateButton = await screen.findByTestId('update-btn');

    await act(async () => {
      userEvent.click(updateButton);
    });

    // onChange should be called with previous selected keys and current selected keys
    expect(mockOnChange).toHaveBeenCalledWith(
      ['User 1', 'User 2'],
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

    let option1Checkbox = await screen.findByTestId('User 1-checkbox');

    expect(option1Checkbox).toBeChecked();

    const option1 = await screen.findByTestId('User 1');

    await act(async () => {
      userEvent.click(option1);
    });

    option1Checkbox = await screen.findByTestId('User 1-checkbox');

    expect(option1Checkbox).not.toBeChecked();
  });

  it('Close button should work properly', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown');

    expect(container).toBeInTheDocument();

    let dropdownMenu = screen.queryByTestId('drop-down-menu');

    expect(dropdownMenu).toBeNull();

    await act(async () => {
      userEvent.click(container);
    });

    dropdownMenu = await screen.findByTestId('drop-down-menu');

    expect(dropdownMenu).toBeInTheDocument();

    const closeButton = await screen.findByTestId('update-btn');

    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(closeButton);
    });

    dropdownMenu = screen.queryByTestId('drop-down-menu');

    expect(dropdownMenu).toBeNull();
  });
});
