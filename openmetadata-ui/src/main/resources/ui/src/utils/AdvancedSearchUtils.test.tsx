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

import {
  getFieldsWithDefaultFlags,
  getSearchDropdownLabels,
  getSelectedOptionLabelString,
  getShouldShowCloseIcon,
} from './AdvancedSearchUtils';
import {
  mockLongOptionsArray,
  mockMenuItem,
  mockMenuItemsWithDefaultKey,
  mockOptionsArray,
  mockShortOptionsArray,
} from './mocks/AdvancedSearchUtils.mock';

describe('AdvancedSearchUtils tests', () => {
  it('Function getFieldsWithDefaultFlags should return defaultField as true for first two items in input array and false for others', () => {
    const resultItemsArray = getFieldsWithDefaultFlags(mockMenuItem);

    expect(resultItemsArray).toEqual(mockMenuItemsWithDefaultKey);
  });

  it('Function getShouldShowCloseIcon should return true if defaultField value is false for given key value item', () => {
    const resultShouldShowCloseIcon = getShouldShowCloseIcon(
      mockMenuItemsWithDefaultKey,
      'User 3'
    );

    expect(resultShouldShowCloseIcon).toEqual(true);
  });

  it('Function getShouldShowCloseIcon should return false if defaultField value is true for given key value item', () => {
    const resultShouldShowCloseIcon = getShouldShowCloseIcon(
      mockMenuItemsWithDefaultKey,
      'User 1'
    );

    expect(resultShouldShowCloseIcon).toEqual(false);
  });

  it('Function getSearchDropdownLabels should return menuItems for passed options', () => {
    const resultMenuItems = getSearchDropdownLabels(mockOptionsArray, true);

    expect(resultMenuItems).toHaveLength(4);
  });

  it('Function getSelectedOptionLabelString should return all options if the length of resultant string is less than 15', () => {
    const resultOptionsString = getSelectedOptionLabelString(
      mockShortOptionsArray
    );

    expect(resultOptionsString).toEqual('str1,str2');
  });

  it('Function getSelectedOptionLabelString should return string with ellipsis if the length of resultant string is more than 15', () => {
    const resultOptionsString =
      getSelectedOptionLabelString(mockLongOptionsArray);

    expect(resultOptionsString).toEqual('string1,str...');
  });
});
