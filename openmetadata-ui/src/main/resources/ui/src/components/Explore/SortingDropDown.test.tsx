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

import { act, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SortingDropDown from './SortingDropDown';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <button {...props}>{children}</button>
    )),
  Dropdown: {
    Root: jest.fn().mockImplementation(({ children, ...props }) => (
      <div data-testid="dropdown" {...props}>
        {children}
      </div>
    )),
    Popover: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Menu: jest.fn().mockImplementation(({ children, ...props }) => (
      <div role="menu" {...props}>
        {children}
      </div>
    )),
    Item: jest.fn().mockImplementation(({ children, onClick, ...props }) => (
      <div role="menuitem" onClick={onClick} {...props}>
        {children}
      </div>
    )),
  },
}));

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span>ChevronDown</span>,
}));

const handleFieldDropDown = jest.fn();
const fieldList = [
  { name: 'Popularity', value: 'totalVotes' },
  { name: 'Name', value: 'displayName.keyword' },
  { name: 'Weekly Usage', value: 'usageSummary.weeklyStats.count' },
  { name: 'Relevance', value: '_score' },
  { name: 'Last Updated', value: 'updatedAt' },
];
const sortField = '';

const mockProps = {
  fieldList,
  sortField,
  handleFieldDropDown,
};

describe('Test Sorting DropDown Component', () => {
  it('Should render dropdown component', async () => {
    const { findByTestId, findByRole } = render(
      <MemoryRouter>
        <SortingDropDown {...mockProps} />
      </MemoryRouter>
    );

    const dropdown = await findByTestId('dropdown');

    expect(dropdown).toBeInTheDocument();

    const dropdownButton = dropdown.querySelector('button');

    expect(dropdownButton).toBeInTheDocument();

    fireEvent.click(dropdownButton!);

    const dropdownMenu = await findByRole('menu');

    expect(dropdownMenu).toBeInTheDocument();

    const menuItems = dropdownMenu.querySelectorAll('[role="menuitem"]');

    expect(menuItems).toHaveLength(fieldList.length);
  });

  it('Should call onSelect method on onClick option', async () => {
    const { findByTestId, findByRole } = render(
      <MemoryRouter>
        <SortingDropDown {...mockProps} />
      </MemoryRouter>
    );

    const dropdown = await findByTestId('dropdown');

    expect(dropdown).toBeInTheDocument();

    const dropdownButton = dropdown.querySelector('button');

    expect(dropdownButton).toBeInTheDocument();

    fireEvent.click(dropdownButton!);

    const dropdownMenu = await findByRole('menu');

    expect(dropdownMenu).toBeInTheDocument();

    const menuItems = dropdownMenu.querySelectorAll('[role="menuitem"]');

    expect(menuItems).toHaveLength(fieldList.length);

    act(() => {
      fireEvent.click(menuItems[0]);
    });

    expect(handleFieldDropDown).toHaveBeenCalledWith('totalVotes');
  });
});
