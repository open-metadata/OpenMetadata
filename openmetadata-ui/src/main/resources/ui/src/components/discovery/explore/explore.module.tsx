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

import { ReactComponent as ExploreIcon } from '../../../assets/svg/explore.svg';
import { ROUTES } from '../../../constants/constants';
import { AppModule } from '../../platform/ai-shell/AppModule.types';

/**
 * Explore module — the AI sidebar's data-discovery entry. The Explore
 * page (`ExplorePageV1`) is served by the shell's page-table fallback, which
 * picks its presentation from the active app mode; this module only surfaces
 * the sidebar icon and points it at `/explore`.
 */
export const exploreModule: AppModule = {
  id: 'explore',
  navOrder: 10,
  labelKey: 'label.explore',
  icon: ExploreIcon,
  prefix: ROUTES.EXPLORE,
  defaultPath: ROUTES.EXPLORE,
  routes: [],
};
