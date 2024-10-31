/*
 *  Copyright 2024 Collate.
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
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { AdvancedSearchClassBase } from './AdvancedSearchClassBase';

describe('AdvancedSearchClassBase', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
  });

  it('getCommonConfig function should return expected fields', () => {
    const result = advancedSearchClassBase.getCommonConfig({});

    expect(Object.keys(result)).toEqual([
      EntityFields.DISPLAY_NAME_KEYWORD,
      EntityFields.NAME_KEYWORD,
      'deleted',
      EntityFields.OWNERS,
      EntityFields.DOMAIN,
      'serviceType',
      EntityFields.TAG,
      EntityFields.TIER,
      'extension',
      'descriptionStatus',
    ]);
  });
});
