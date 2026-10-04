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
import {
  APPLICATION_NAV_ITEMS,
  PROFILE_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
} from '../components/discovery/personal-space/Profile/profileNavConfig';
import { PROFILE_NAV_IDS } from './Profile.constants';

describe('PROFILE_NAV_IDS', () => {
  // Regression guard: a nav item whose id is missing from PROFILE_NAV_IDS makes
  // parseHash reject that tab (tab=null), which closes the modal and breaks the
  // panel's hash sync (the Bots-tab loop/close bug).
  it('should contain every rendered profile nav item id', () => {
    const renderedIds = [
      ...PROFILE_NAV_ITEMS,
      ...WORKSPACE_NAV_ITEMS,
      ...APPLICATION_NAV_ITEMS,
    ].map((item) => item.id);

    const missing = renderedIds.filter((id) => !PROFILE_NAV_IDS.has(id));

    expect(missing).toEqual([]);
  });
});
