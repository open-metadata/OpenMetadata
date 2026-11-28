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
import { HeaderProperty } from '../components/DataAssets/EntityHeaderProperties/EntityHeaderProperties.types';
import { HeaderPropertyId } from '../constants/EntityHeaderProperties.constants';
import { getShownHeaderProperties } from './EntityHeaderProperties.utils';

const property = (
  id: HeaderPropertyId,
  overrides: Partial<HeaderProperty> = {}
): HeaderProperty => ({
  id,
  label: id,
  isEmpty: false,
  isReadOnly: false,
  content: id,
  ...overrides,
});

describe('EntityHeaderProperties utils', () => {
  it('never shows an empty read-only property but keeps an empty editable one', () => {
    const shown = getShownHeaderProperties([
      property(HeaderPropertyId.Owners),
      property(HeaderPropertyId.Tier, { isEmpty: true }),
      property(HeaderPropertyId.Usage, { isEmpty: true, isReadOnly: true }),
      property(HeaderPropertyId.Type, { isReadOnly: true }),
    ]);

    expect(shown.map(({ id }) => id)).toEqual(['owners', 'tier', 'type']);
  });
});
