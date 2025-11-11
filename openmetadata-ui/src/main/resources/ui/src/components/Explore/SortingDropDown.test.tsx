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
import { tableSortingFields } from '../../constants/explore.constants';
import SortingDropDown from './SortingDropDown';

const handleFieldDropDown = jest.fn();
const fieldList = tableSortingFields;
const sortField = '';

const mockPorps = {
  fieldList,
  sortField,
  handleFieldDropDown,
};

describe('Test Sorting DropDown Component', () => {
  it('Should render dropdown component', async () => {
    const { findByTestId, findByRole, findAllByTestId } = render(
      <SortingDropDown {...mockPorps} />
    );

    const dropdownLabel = await findByTestId('sorting-dropdown-label');

    expect(dropdownLabel).toBeInTheDocument();

    fireEvent.click(dropdownLabel);

    const dropdownMenu = await findByRole('menu');

    expect(dropdownMenu).toBeInTheDocument();

    const menuItems = await findAllByTestId('dropdown-menu-item');

    expect(menuItems).toHaveLength(fieldList.length);
  });

  it('Should call onSelect method on onClick option', async () => {
    const { findByTestId, findByRole, findAllByTestId } = render(
      <SortingDropDown {...mockPorps} />
    );

    const dropdownLabel = await findByTestId('sorting-dropdown-label');

    expect(dropdownLabel).toBeInTheDocument();

    fireEvent.click(dropdownLabel);

    const dropdownMenu = await findByRole('menu');

    expect(dropdownMenu).toBeInTheDocument();

    const menuItems = await findAllByTestId('dropdown-menu-item');

    expect(menuItems).toHaveLength(fieldList.length);

    act(() => {
      fireEvent.click(menuItems[0]);
    });

    expect(handleFieldDropDown).toHaveBeenCalledWith('totalVotes');
  });
});
