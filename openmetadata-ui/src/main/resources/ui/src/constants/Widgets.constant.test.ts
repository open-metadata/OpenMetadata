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
import { CURATED_ASSETS_SORT_BY_KEYS } from '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsWidget.constants';
import { getSortField, getSortOrder } from './Widgets.constant';

describe('getSortField', () => {
  it.each([
    [CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z, 'asc'],
    [CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A, 'desc'],
  ])('sorts %s on the visible title, not the internal name', (key, order) => {
    expect(getSortField(key)).toBe('displayName.keyword');
    expect(getSortOrder(key)).toBe(order);
  });

  it('sorts Latest on updatedAt', () => {
    expect(getSortField(CURATED_ASSETS_SORT_BY_KEYS.LATEST)).toBe('updatedAt');
  });

  it('prefers an explicit field over the default', () => {
    expect(getSortField(CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z, 'custom')).toBe(
      'custom'
    );
  });
});
