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

import { ReactComponent as HomeActiveIcon } from '../../../assets/svg/ask-collate-nav-bar/home-active.svg';
import { ReactComponent as HomeIcon } from '../../../assets/svg/ask-collate-nav-bar/home.svg';
import { ROUTES } from '../../../constants/constants';
import { AppModule } from '../../platform/ai-shell/AppModule.types';

/**
 * Home module — the AI sidebar's landing entry. Owns no routes of its
 * own: the home landing page at `/` is served by the shell's page-table
 * fallback (`applicationRoutesClass.getRouteElements()`); this module exists
 * purely to surface the sidebar icon and point it at `/`. It must not point at
 * `/my-data`: in app mode that path is the personal-space My Data page.
 * A `/` prefix matches `/` alone, so Home is active only on the landing page.
 */
export const homeModule: AppModule = {
  id: 'home',
  navOrder: 0,
  labelKey: 'label.home',
  icon: HomeIcon,
  activeIcon: HomeActiveIcon,
  prefix: ROUTES.HOME,
  defaultPath: ROUTES.HOME,
  routes: [],
};
