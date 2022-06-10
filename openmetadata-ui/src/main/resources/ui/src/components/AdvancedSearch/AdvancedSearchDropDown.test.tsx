/*
 *  Copyright 2021 Collate
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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import {
  COMMON_DROPDOWN_ITEMS,
  TABLE_DROPDOWN_ITEMS,
} from '../../constants/advanceSearch.constants';
import { AdvanceField } from '../Explore/explore.interface';
import AdvancedSearchDropDown from './AdvancedSearchDropDown';

const mockItems = [...COMMON_DROPDOWN_ITEMS, ...TABLE_DROPDOWN_ITEMS];

jest.mock('../../utils/AdvancedSearchUtils', () => ({
  getDropDownItems: jest
    .fn()
    .mockReturnValue([...COMMON_DROPDOWN_ITEMS, ...TABLE_DROPDOWN_ITEMS]),
}));

const onSelect = jest.fn();
const selectedItems = [] as AdvanceField[];
const index = 'table_search_index';

const mockPorps = {
  selectedItems,
  index,
  onSelect,
};

describe('Test AdvancedSearch DropDown Component', () => {
  it('Should render dropdown component', async () => {
    const { findByTestId, findAllByTestId } = render(
      <AdvancedSearchDropDown {...mockPorps} />
    );

    const dropdownLabel = await findByTestId('dropdown-label');

    expect(dropdownLabel).toBeInTheDocument();

    fireEvent.click(dropdownLabel);

    const dropdownMenu = await findByTestId('dropdown-menu');

    expect(dropdownMenu).toBeInTheDocument();

    const menuItems = await findAllByTestId('dropdown-menu-item');

    expect(menuItems).toHaveLength(mockItems.length);
  });

  it('Should call onSelect method on onClick option', async () => {
    const { findByTestId, findAllByTestId } = render(
      <AdvancedSearchDropDown {...mockPorps} />
    );

    const dropdownLabel = await findByTestId('dropdown-label');

    expect(dropdownLabel).toBeInTheDocument();

    fireEvent.click(dropdownLabel);

    const dropdownMenu = await findByTestId('dropdown-menu');

    expect(dropdownMenu).toBeInTheDocument();

    const menuItems = await findAllByTestId('dropdown-menu-item');

    expect(menuItems).toHaveLength(mockItems.length);

    fireEvent.click(menuItems[0]);

    expect(onSelect).toHaveBeenCalledWith(mockItems[0].key);
  });

  it('Selected option should be disabled', async () => {
    const { findByTestId, findAllByTestId } = render(
      <AdvancedSearchDropDown
        {...mockPorps}
        selectedItems={[{ key: mockItems[0].key, value: undefined }]}
      />
    );

    const dropdownLabel = await findByTestId('dropdown-label');

    expect(dropdownLabel).toBeInTheDocument();

    fireEvent.click(dropdownLabel);

    const dropdownMenu = await findByTestId('dropdown-menu');

    expect(dropdownMenu).toBeInTheDocument();

    const menuItems = await findAllByTestId('dropdown-menu-item');

    expect(menuItems).toHaveLength(mockItems.length);

    expect(menuItems[0]).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(menuItems[0]);

    expect(onSelect).not.toHaveBeenCalledWith(mockItems[0].key);
  });
});
