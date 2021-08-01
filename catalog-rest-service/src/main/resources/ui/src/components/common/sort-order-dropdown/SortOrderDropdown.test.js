import {
  fireEvent,
  getAllByTestId,
  getByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import SortOrderDropdown from './SortOrderDropdown';

describe('Test Dropdown Component', () => {
  const onDropdownOptionChange = jest.fn();

  it('Renders the dropdown with the options sent to it', () => {
    const { container } = render(
      <SortOrderDropdown
        options={['testItem1', 'testItem2', 'testItem3']}
        onChange={onDropdownOptionChange}
      />
    );
    const dropdownOptions = getAllByTestId(container, 'dropdown-option');

    expect(dropdownOptions.length).toBe(3);
    expect(
      dropdownOptions.map((option) => {
        return option.textContent;
      })
    ).toStrictEqual(['testItem1', 'testItem2', 'testItem3']);
  });

  it('Changes the selected option on change event called', () => {
    const onDropdownOptionChange = jest.fn();
    const { container } = render(
      <SortOrderDropdown
        options={['testItem1', 'testItem2', 'testItem3']}
        onChange={onDropdownOptionChange}
      />
    );
    const dropdownContainer = getByTestId(container, 'dropdown-container');

    expect(dropdownContainer.value).toBe('testitem1');

    fireEvent.change(dropdownContainer, { target: { value: 'testitem2' } });

    expect(dropdownContainer.value).toBe('testitem2');
  });

  it('Calls the callback function on change of the dropdownn value with the proper option selected', () => {
    const onDropdownOptionChange = jest.fn();
    const { container } = render(
      <SortOrderDropdown
        options={['testItem1', 'testItem2', 'testItem3']}
        onChange={onDropdownOptionChange}
      />
    );
    const dropdownContainer = getByTestId(container, 'dropdown-container');
    fireEvent.change(dropdownContainer, { target: { value: 'testitem2' } });

    expect(onDropdownOptionChange).toBeCalledWith('testitem2');

    fireEvent.change(dropdownContainer, { target: { value: 'testitem3' } });

    expect(onDropdownOptionChange).toBeCalledWith('testitem3');
  });
});
