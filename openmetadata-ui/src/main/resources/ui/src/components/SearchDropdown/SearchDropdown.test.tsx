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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchDropdown from './SearchDropdown';
import { SearchDropdownProps } from './SearchDropdown.interface';

const mockOnChange = jest.fn();
const mockOnSearch = jest.fn();

const searchOptions = [
  { key: 'User 1', label: 'User 1' },
  { key: 'User 2', label: 'User 2' },
  { key: 'User 3', label: 'User 3' },
  { key: 'User 4', label: 'User 4' },
  { key: 'User 5', label: 'User 5' },
];

const mockProps: SearchDropdownProps = {
  label: 'Owner',
  isSuggestionsLoading: false,
  options: searchOptions,
  searchKey: 'owner.displayName',
  selectedKeys: [{ key: 'User 1', label: 'User 1' }],
  onChange: mockOnChange,
  onSearch: mockOnSearch,
  index: 'table_search_index' as SearchDropdownProps['index'],
};

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  // Assign the import a new implementation, in this case it's execute the function given to you
  debounce: jest.fn().mockImplementation((fn) => fn),
}));

describe('Search DropDown Component', () => {
  it('Should render Dropdown components', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown-Owner');

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

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    userEvent.click(container);

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    // User 1 is selected key so should be checked
    expect(await screen.findByTestId('User 1-checkbox')).toBeChecked();
  });

  it('UnSelected keys option should not be checked', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    userEvent.click(container);

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    expect(await screen.findByTestId('User 2-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 3-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 4-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 5-checkbox')).not.toBeChecked();
  });

  it('Should render the clear all button after more than one options are selected and click should work', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const option2 = await screen.findByTestId('User 2');

    await act(async () => {
      fireEvent.click(option2);
    });

    let option1Checkbox = await screen.findByTestId('User 1-checkbox');
    let option2Checkbox = await screen.findByTestId('User 2-checkbox');

    expect(option1Checkbox).toBeChecked();

    await waitFor(() => {
      expect(option2Checkbox).toBeChecked();
    });

    const clearButton = await screen.findByTestId('clear-button');

    expect(clearButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(clearButton);
    });

    option1Checkbox = await screen.findByTestId('User 1-checkbox');
    option2Checkbox = await screen.findByTestId('User 2-checkbox');

    expect(option1Checkbox).not.toBeChecked();
    expect(option2Checkbox).not.toBeChecked();
  });

  it('Search should work', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    await act(async () => {
      const searchInput = await screen.findByTestId('search-input');
      await fireEvent.change(searchInput, { target: { value: 'user' } });
    });

    expect(await screen.findByTestId('search-input')).toHaveValue('user');

    expect(mockOnSearch).toHaveBeenCalledWith('user', 'owner.displayName');
  });

  it('Update button should work properly', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const option2 = await screen.findByTestId('User 2');

    await act(async () => {
      fireEvent.click(option2);
    });

    const updateButton = await screen.findByTestId('update-btn');

    await act(async () => {
      fireEvent.click(updateButton);
    });

    // onChange should be called with previous selected keys and current selected keys
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        [
          { key: 'User 1', label: 'User 1' },
          { key: 'User 2', label: 'User 2' },
        ],
        'owner.displayName'
      );
    });
  });

  it('Selected option should unselect on next click', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    let option1Checkbox = await screen.findByTestId('User 1-checkbox');

    expect(option1Checkbox).toBeChecked();

    const option1 = await screen.findByTestId('User 1');

    await act(async () => {
      fireEvent.click(option1);
    });

    option1Checkbox = await screen.findByTestId('User 1-checkbox');

    expect(option1Checkbox).not.toBeChecked();
  });

  it('Close button should work properly', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    let dropdownMenu = screen.queryByTestId('drop-down-menu');

    expect(dropdownMenu).toBeNull();

    await act(async () => {
      fireEvent.click(container);
    });

    dropdownMenu = await screen.findByTestId('drop-down-menu');

    expect(dropdownMenu).toBeInTheDocument();

    const closeButton = await screen.findByTestId('update-btn');

    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(closeButton);
    });

    dropdownMenu = screen.queryByTestId('drop-down-menu');

    expect(dropdownMenu).toBeNull();
  });

  it('The selected options should be checked correctly each time popover renders', async () => {
    render(<SearchDropdown {...mockProps} />);

    const dropdownButton = await screen.findByTestId('search-dropdown-Owner');

    // Dropdown menu should not be present

    let dropdownMenu = screen.queryByTestId('drop-down-menu');

    expect(dropdownMenu).toBeNull();

    // Click on dropdown button

    await act(async () => {
      fireEvent.click(dropdownButton);
    });

    // Dropdown menu should render and checkbox for user1 should be checked as it is passed in 'selectedKeys'

    dropdownMenu = await screen.findByTestId('drop-down-menu');

    expect(dropdownMenu).toBeInTheDocument();

    let option1Checkbox = await screen.findByTestId('User 1-checkbox');

    expect(option1Checkbox).toBeChecked();

    // Uncheck the 'user1' checkbox

    await act(async () => {
      fireEvent.click(option1Checkbox);
    });

    // Check if 'user1' options is unselected

    option1Checkbox = await screen.findByTestId('User 1-checkbox');

    expect(option1Checkbox).not.toBeChecked();

    // Close the dropdown without updating the changes and check if dropdown is closed.

    const closeButton = await screen.findByTestId('update-btn');

    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(closeButton);
    });

    dropdownMenu = screen.queryByTestId('drop-down-menu');

    expect(dropdownMenu).toBeNull();

    // Open the dropdown again.

    await act(async () => {
      fireEvent.click(dropdownButton);
    });

    dropdownMenu = await screen.findByTestId('drop-down-menu');

    expect(dropdownMenu).toBeInTheDocument();

    // Checkbox for 'user1' option should already be checked.

    option1Checkbox = await screen.findByTestId('User 1-checkbox');

    expect(option1Checkbox).toBeChecked();
  });

  it('should render no option checkbox', async () => {
    render(<SearchDropdown {...mockProps} hasNullOption />);

    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const noOwnerCheckbox = await screen.findByTestId('no-option-checkbox');

    expect(noOwnerCheckbox).toBeInTheDocument();
  });

  it('Should send null option in payload if selected', async () => {
    render(<SearchDropdown {...mockProps} hasNullOption />);
    const container = await screen.findByTestId('search-dropdown-Owner');

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId('drop-down-menu')).toBeInTheDocument();

    const noOwnerCheckbox = await screen.findByTestId('no-option-checkbox');
    await act(async () => {
      fireEvent.click(noOwnerCheckbox);
    });

    const updateButton = await screen.findByTestId('update-btn');
    await act(async () => {
      fireEvent.click(updateButton);
    });

    // onChange should be called with previous selected keys and current selected keys
    expect(mockOnChange).toHaveBeenCalledWith(
      [
        { key: 'OM_NULL_FIELD', label: 'label.no-entity' },
        { key: 'User 1', label: 'User 1' },
      ],
      'owner.displayName'
    );
  });
});
