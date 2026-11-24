/*
 *  Copyright 2025 Collate.
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

import { isFocusWithinSearchControl } from './ExploreSearchInput.utils';

describe('isFocusWithinSearchControl', () => {
  it('returns true for focus within the search container', () => {
    const searchContainer = document.createElement('form');
    const input = document.createElement('input');
    searchContainer.append(input);

    expect(isFocusWithinSearchControl(input, searchContainer)).toBe(true);
  });

  it('returns true for focus within the portalled search popover', () => {
    const searchContainer = document.createElement('form');
    const popover = document.createElement('div');
    const suggestion = document.createElement('button');
    popover.dataset.testid = 'explore-search-popover';
    popover.append(suggestion);

    expect(isFocusWithinSearchControl(suggestion, searchContainer)).toBe(true);
  });

  it('returns false when focus leaves the search control', () => {
    const searchContainer = document.createElement('form');

    expect(isFocusWithinSearchControl(document.body, searchContainer)).toBe(
      false
    );
    expect(isFocusWithinSearchControl(null, searchContainer)).toBe(false);
  });
});
