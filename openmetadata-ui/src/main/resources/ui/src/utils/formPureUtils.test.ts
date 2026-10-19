/*
 *  Copyright 2026 Collate.
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

import { TranslatableString } from '@rjsf/utils';
import { translateFormString } from './formPureUtils';

describe('translateFormString', () => {
  it('starts a new map entry with an empty value', () => {
    expect(translateFormString(TranslatableString.NewStringDefault)).toBe('');
  });

  it('keeps the other RJSF strings', () => {
    expect(translateFormString(TranslatableString.AddItemButton)).toBe(
      'Add Item'
    );
  });
});
