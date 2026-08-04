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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import SearchDropdown from './SearchDropdown';
import { SearchDropdownProps } from './SearchDropdown.interface';

const OWNER_DISPLAYNAME = 'owner.displayName';
const SEARCH_DROPDOWN_OWNER = 'search-dropdown-Owner';
const DROP_DOWN_MENU = 'drop-down-menu';
const SEARCH_INPUT = 'search-input';
const CLEAR_BUTTON = 'clear-button';
const UPDATE_BTN = 'update-btn';
const USER_1_CHECKBOX = 'User 1-checkbox';
const USER_2_CHECKBOX = 'User 2-checkbox';
const NO_OPTION_CHECKBOX = 'no-option-checkbox';
const USER_1_RADIO = 'User 1-radio';

const mockOnChange = jest.fn();
const mockOnSearch = jest.fn();
// Route changes are mocked so the dropdown cleanup can be tested without a router.
const mockUseLocation = jest.fn();

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
  searchKey: OWNER_DISPLAYNAME,
  selectedKeys: [{ key: 'User 1', label: 'User 1' }],
  onChange: mockOnChange,
  onSearch: mockOnSearch,
  index: 'table' as SearchDropdownProps['index'],
};

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  // Run the debounced fn synchronously, but still expose a no-op cancel() so
  // the unmount cleanup (debouncedOnSearch.cancel()) works under the mock.
  debounce: jest
    .fn()
    .mockImplementation((fn) => Object.assign(fn, { cancel: jest.fn() })),
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
}));

describe('Search DropDown Component', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({ pathname: '/explore' });
  });

  it('Should render Dropdown components', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    await act(async () => {
      userEvent.click(container);
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

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

    const searchInput = await screen.findByTestId(SEARCH_INPUT);

    expect(searchInput).toBeInTheDocument();

    const clearButton = screen.queryByTestId(CLEAR_BUTTON);

    expect(clearButton).not.toBeInTheDocument();

    const updateButton = await screen.findByTestId(UPDATE_BTN);
    const closeButton = await screen.findByTestId(UPDATE_BTN);

    expect(updateButton).toBeInTheDocument();
    expect(closeButton).toBeInTheDocument();
  });

  it('Selected keys option should be checked', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    userEvent.click(container);

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    // User 1 is selected key so should be checked
    expect(await screen.findByTestId(USER_1_CHECKBOX)).toBeChecked();
  });

  it('UnSelected keys option should not be checked', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    userEvent.click(container);

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    expect(await screen.findByTestId(USER_2_CHECKBOX)).not.toBeChecked();
    expect(await screen.findByTestId('User 3-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 4-checkbox')).not.toBeChecked();
    expect(await screen.findByTestId('User 5-checkbox')).not.toBeChecked();
  });

  it('Should render the clear all button after more than one options are selected and click should work', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    const option2 = await screen.findByTestId('User 2');

    await act(async () => {
      fireEvent.click(option2);
    });

    let option1Checkbox = await screen.findByTestId(USER_1_CHECKBOX);
    let option2Checkbox = await screen.findByTestId(USER_2_CHECKBOX);

    expect(option1Checkbox).toBeChecked();

    await waitFor(() => {
      expect(option2Checkbox).toBeChecked();
    });

    const clearButton = await screen.findByTestId(CLEAR_BUTTON);

    expect(clearButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(clearButton);
    });

    option1Checkbox = await screen.findByTestId(USER_1_CHECKBOX);
    option2Checkbox = await screen.findByTestId(USER_2_CHECKBOX);

    expect(option1Checkbox).not.toBeChecked();
    expect(option2Checkbox).not.toBeChecked();
  });

  it('Search should work', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    await act(async () => {
      const searchInput = await screen.findByTestId(SEARCH_INPUT);
      fireEvent.change(searchInput, { target: { value: 'user' } });
    });

    expect(await screen.findByTestId(SEARCH_INPUT)).toHaveValue('user');

    expect(mockOnSearch).toHaveBeenCalledWith('user', OWNER_DISPLAYNAME);
  });

  it('Update button should work properly', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    const option2 = await screen.findByTestId('User 2');

    await act(async () => {
      fireEvent.click(option2);
    });

    const updateButton = await screen.findByTestId(UPDATE_BTN);

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
        OWNER_DISPLAYNAME
      );
    });
  });

  it('Selected option should unselect on next click', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    let option1Checkbox = await screen.findByTestId(USER_1_CHECKBOX);

    expect(option1Checkbox).toBeChecked();

    const option1 = await screen.findByTestId('User 1');

    await act(async () => {
      fireEvent.click(option1);
    });

    option1Checkbox = await screen.findByTestId(USER_1_CHECKBOX);

    expect(option1Checkbox).not.toBeChecked();
  });

  it('Close button should work properly', async () => {
    render(<SearchDropdown {...mockProps} />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    let dropdownMenu = screen.queryByTestId(DROP_DOWN_MENU);

    expect(dropdownMenu).toBeNull();

    await act(async () => {
      fireEvent.click(container);
    });

    dropdownMenu = await screen.findByTestId(DROP_DOWN_MENU);

    expect(dropdownMenu).toBeInTheDocument();

    const closeButton = await screen.findByTestId(UPDATE_BTN);

    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(closeButton);
    });

    dropdownMenu = screen.queryByTestId(DROP_DOWN_MENU);

    expect(dropdownMenu).toBeNull();
  });

  it('closes the dropdown when the route pathname changes', async () => {
    const { rerender } = render(<SearchDropdown {...mockProps} />);

    await act(async () => {
      fireEvent.click(await screen.findByTestId(SEARCH_DROPDOWN_OWNER));
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    // Simulate navigating away while the dropdown overlay is still open.
    mockUseLocation.mockReturnValue({ pathname: '/observability' });
    rerender(<SearchDropdown {...mockProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId(DROP_DOWN_MENU)).not.toBeInTheDocument();
    });
  });

  it('The selected options should be checked correctly each time popover renders', async () => {
    render(<SearchDropdown {...mockProps} />);

    const dropdownButton = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    // Dropdown menu should not be present

    let dropdownMenu = screen.queryByTestId(DROP_DOWN_MENU);

    expect(dropdownMenu).toBeNull();

    // Click on dropdown button

    await act(async () => {
      fireEvent.click(dropdownButton);
    });

    // Dropdown menu should render and checkbox for user1 should be checked as it is passed in 'selectedKeys'

    dropdownMenu = await screen.findByTestId(DROP_DOWN_MENU);

    expect(dropdownMenu).toBeInTheDocument();

    let option1Checkbox = await screen.findByTestId(USER_1_CHECKBOX);

    expect(option1Checkbox).toBeChecked();

    // Uncheck the 'user1' checkbox

    await act(async () => {
      fireEvent.click(option1Checkbox);
    });

    // Check if 'user1' options is unselected

    option1Checkbox = await screen.findByTestId(USER_1_CHECKBOX);

    expect(option1Checkbox).not.toBeChecked();

    // Close the dropdown without updating the changes and check if dropdown is closed.

    const closeButton = await screen.findByTestId(UPDATE_BTN);

    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(closeButton);
    });

    dropdownMenu = screen.queryByTestId(DROP_DOWN_MENU);

    expect(dropdownMenu).toBeNull();

    // Open the dropdown again.

    await act(async () => {
      fireEvent.click(dropdownButton);
    });

    dropdownMenu = await screen.findByTestId(DROP_DOWN_MENU);

    expect(dropdownMenu).toBeInTheDocument();

    // Checkbox for 'user1' option should already be checked.

    option1Checkbox = await screen.findByTestId(USER_1_CHECKBOX);

    expect(option1Checkbox).toBeChecked();
  });

  it('should render no option checkbox', async () => {
    render(<SearchDropdown {...mockProps} hasNullOption />);

    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    const noOwnerCheckbox = await screen.findByTestId(NO_OPTION_CHECKBOX);

    expect(noOwnerCheckbox).toBeInTheDocument();
  });

  it('Should send null option in payload if selected', async () => {
    render(<SearchDropdown {...mockProps} hasNullOption />);
    const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

    expect(container).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

    const noOwnerCheckbox = await screen.findByTestId(NO_OPTION_CHECKBOX);
    await act(async () => {
      fireEvent.click(noOwnerCheckbox);
    });

    const updateButton = await screen.findByTestId(UPDATE_BTN);
    await act(async () => {
      fireEvent.click(updateButton);
    });

    // onChange should be called with previous selected keys and current selected keys
    expect(mockOnChange).toHaveBeenCalledWith(
      [
        { key: 'OM_NULL_FIELD', label: 'label.no-entity' },
        { key: 'User 1', label: 'User 1' },
      ],
      OWNER_DISPLAYNAME
    );
  });

  describe('Immediate apply mode', () => {
    it('does not render the Update/Close footer when immediateApply is set', async () => {
      render(<SearchDropdown {...mockProps} immediateApply />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

      await act(async () => {
        fireEvent.click(container);
      });

      expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();
      expect(screen.queryByTestId(UPDATE_BTN)).not.toBeInTheDocument();
      expect(screen.queryByTestId('close-btn')).not.toBeInTheDocument();
    });

    it('applies each selection immediately without clicking Update', async () => {
      mockOnChange.mockClear();

      render(<SearchDropdown {...mockProps} immediateApply />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

      await act(async () => {
        fireEvent.click(container);
      });

      const option2 = await screen.findByTestId('User 2');

      await act(async () => {
        fireEvent.click(option2);
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        [
          { key: 'User 1', label: 'User 1' },
          { key: 'User 2', label: 'User 2' },
        ],
        OWNER_DISPLAYNAME
      );
    });

    it('keeps a selected option visible even when missing from fetched options', async () => {
      // Immediate-apply facets exclude their own field from the aggregation,
      // so a selected value may fall outside the fetched top-N options.
      render(
        <SearchDropdown
          {...mockProps}
          immediateApply
          selectedKeys={[{ key: 'glossaryterm', label: 'glossaryterm' }]}
        />
      );

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

      await act(async () => {
        fireEvent.click(container);
      });

      expect(await screen.findByTestId('glossaryterm')).toBeInTheDocument();
      expect(await screen.findByTestId('glossaryterm-checkbox')).toBeChecked();
    });

    it('renders the selected option with its fetched count and label, not the raw selected value', async () => {
      // Regression: selecting a value must keep the aggregation count + human
      // label (Table / 307), not fall back to the raw chip value (table / 0).
      render(
        <SearchDropdown
          {...mockProps}
          immediateApply
          hideCounts={false}
          options={[
            { key: 'table', label: 'Table', count: 307 },
            { key: 'column', label: 'Column', count: 52535 },
          ]}
          selectedKeys={[{ key: 'table', label: 'table' }]}
        />
      );

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

      await act(async () => {
        fireEvent.click(container);
      });

      expect(await screen.findByTestId('table-checkbox')).toBeChecked();
      expect(await screen.findByText('307')).toBeInTheDocument();
    });

    it('renders the helper text in immediateApply mode', async () => {
      render(
        <SearchDropdown
          {...mockProps}
          immediateApply
          helperText="Pick values to refine."
        />
      );

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);

      await act(async () => {
        fireEvent.click(container);
      });

      expect(
        await screen.findByTestId('search-dropdown-helper-text')
      ).toHaveTextContent('Pick values to refine.');
    });
  });

  describe('Single Select Mode', () => {
    it('should allow only one option to be selected at a time', async () => {
      render(<SearchDropdown {...mockProps} singleSelect />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);
      await act(async () => {
        fireEvent.click(container);
      });

      expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

      // User 1 is initially selected (in single-select mode, testid suffix is 'radio')
      let option1Radio = await screen.findByTestId(USER_1_RADIO);

      expect(option1Radio).toBeChecked();

      // Select User 2
      const option2 = await screen.findByTestId('User 2');

      await act(async () => {
        fireEvent.click(option2);
      });

      // User 1 should be unchecked, User 2 should be checked
      option1Radio = await screen.findByTestId(USER_1_RADIO);
      const option2Radio = await screen.findByTestId('User 2-radio');

      expect(option1Radio).not.toBeChecked();
      expect(option2Radio).toBeChecked();
    });

    it('should deselect option when clicking the same option again in single-select mode', async () => {
      render(<SearchDropdown {...mockProps} singleSelect />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);
      await act(async () => {
        fireEvent.click(container);
      });

      expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

      // User 1 is initially selected (in single-select mode, testid suffix is 'radio')
      let option1Radio = await screen.findByTestId(USER_1_RADIO);

      expect(option1Radio).toBeChecked();

      // Click User 1 again to deselect
      const option1 = await screen.findByTestId('User 1');

      await act(async () => {
        fireEvent.click(option1);
      });

      // User 1 should be unchecked
      option1Radio = await screen.findByTestId(USER_1_RADIO);

      expect(option1Radio).not.toBeChecked();
    });

    it('should not show clear all button in single-select mode', async () => {
      render(<SearchDropdown {...mockProps} singleSelect />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);
      await act(async () => {
        fireEvent.click(container);
      });

      expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

      // Select another option
      const option2 = await screen.findByTestId('User 2');
      await act(async () => {
        fireEvent.click(option2);
      });

      // Clear button should not be present
      const clearButton = screen.queryByTestId(CLEAR_BUTTON);

      expect(clearButton).not.toBeInTheDocument();
    });

    it('should call onChange with single selected option', async () => {
      render(<SearchDropdown {...mockProps} singleSelect />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);
      await act(async () => {
        fireEvent.click(container);
      });

      // Select User 3
      const option3 = await screen.findByTestId('User 3');
      await act(async () => {
        fireEvent.click(option3);
      });

      const updateButton = await screen.findByTestId(UPDATE_BTN);
      await act(async () => {
        fireEvent.click(updateButton);
      });

      // onChange should be called with only User 3
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          [{ key: 'User 3', label: 'User 3' }],
          OWNER_DISPLAYNAME
        );
      });
    });

    it('should render radio button for null option in single-select mode', async () => {
      render(<SearchDropdown {...mockProps} hasNullOption singleSelect />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);
      await act(async () => {
        fireEvent.click(container);
      });

      expect(await screen.findByTestId(DROP_DOWN_MENU)).toBeInTheDocument();

      // Should render radio instead of checkbox
      const noOptionRadio = await screen.findByTestId('no-option-radio');

      expect(noOptionRadio).toBeInTheDocument();

      // Checkbox should not be present
      const noOptionCheckbox = screen.queryByTestId(NO_OPTION_CHECKBOX);

      expect(noOptionCheckbox).not.toBeInTheDocument();
    });

    it('should handle null option selection in single-select mode', async () => {
      render(<SearchDropdown {...mockProps} hasNullOption singleSelect />);

      const container = await screen.findByTestId(SEARCH_DROPDOWN_OWNER);
      await act(async () => {
        fireEvent.click(container);
      });

      const noOptionRadio = await screen.findByTestId('no-option-radio');

      await act(async () => {
        fireEvent.click(noOptionRadio);
      });

      const updateButton = await screen.findByTestId(UPDATE_BTN);

      await act(async () => {
        fireEvent.click(updateButton);
      });

      // In single-select mode, selecting null option clears regular selections
      expect(mockOnChange).toHaveBeenCalledWith(
        [{ key: 'OM_NULL_FIELD', label: 'label.no-entity' }],
        OWNER_DISPLAYNAME
      );
    });
  });
});
