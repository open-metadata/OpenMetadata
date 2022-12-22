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

import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import {
  getSearchDropdownLabels,
  getSelectedOptionLabelString,
} from './AdvancedSearchUtils';
import {
  mockLongOptionsArray,
  mockOptionsArray,
  mockShortOptionsArray,
} from './mocks/AdvancedSearchUtils.mock';

describe('AdvancedSearchUtils tests', () => {
  it('Function getSearchDropdownLabels should return menuItems for passed options', () => {
    const resultMenuItems = getSearchDropdownLabels(mockOptionsArray, true);

    expect(resultMenuItems).toHaveLength(4);
  });

  it('Function getSearchDropdownLabels should return an empty array if passed 1st argument as other than array', () => {
    const resultMenuItems = getSearchDropdownLabels(
      '' as unknown as SearchDropdownOption[],
      true
    );

    expect(resultMenuItems).toHaveLength(0);
  });

  it('Function getSearchDropdownLabels should return menuItems for passed options if third argument is passed', () => {
    const resultMenuItems = getSearchDropdownLabels(
      mockOptionsArray,
      true,
      'option'
    );

    expect(resultMenuItems).toHaveLength(4);
  });

  it('Function getSelectedOptionLabelString should return all options if the length of resultant string is less than 15', () => {
    const resultOptionsString = getSelectedOptionLabelString(
      mockShortOptionsArray
    );

    expect(resultOptionsString).toEqual('str1, str2');
  });

  it('Function getSelectedOptionLabelString should return string with ellipsis if the length of resultant string is more than 15', () => {
    const resultOptionsString =
      getSelectedOptionLabelString(mockLongOptionsArray);

    expect(resultOptionsString).toEqual('string1, st...');
  });

  it('Function getSelectedOptionLabelString should return an empty string when passed anything else than string array as an argument', () => {
    const resultOptionsString = getSelectedOptionLabelString(
      'invalidInput' as unknown as SearchDropdownOption[]
    );

    expect(resultOptionsString).toEqual('');
  });
});
