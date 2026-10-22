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
import { ROUTES } from '../../../constants/constants';
import {
  buildMainNavItems,
  resolveNavHref,
} from '../../platform/ai-shell/Sidebar/navConfig';
import { matchModuleByPathname } from '../../platform/ai-shell/state/useActiveModule';
import { exploreModule } from '../explore/explore.module';
import { personalSpaceModule } from '../personal-space/personalSpace.module';
import { homeModule } from './home.module';

const MODULES = [homeModule, exploreModule, personalSpaceModule];

describe('homeModule', () => {
  it('points the sidebar Home item at the landing page, not /my-data', () => {
    const home = buildMainNavItems(MODULES).find(({ key }) => key === 'home');

    expect(home && resolveNavHref(home.action)).toBe(ROUTES.HOME);
  });

  it('is the active module on the landing page', () => {
    expect(matchModuleByPathname(ROUTES.HOME, MODULES)).toBe('home');
  });

  it('leaves /my-data to the personal-space module and other paths to theirs', () => {
    expect(matchModuleByPathname(ROUTES.MY_DATA, MODULES)).toBe(
      personalSpaceModule.id
    );
    expect(matchModuleByPathname(ROUTES.EXPLORE, MODULES)).toBe(
      exploreModule.id
    );
  });
});
