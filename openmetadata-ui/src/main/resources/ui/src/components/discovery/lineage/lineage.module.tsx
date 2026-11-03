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
  PlatformLineage,
  PlatformLineageActive,
} from '@openmetadata/ui-core-components/icons';
import { ROUTES } from '../../../constants/constants';
import { AppModule } from '../../platform/ai-shell/AppModule.types';

/**
 * Lineage module — the AI sidebar's entry to the main Lineage page. The page
 * itself is served by the shell's page-table fallback, like Explore; this
 * module only surfaces the sidebar icon and points it at `/lineage`.
 *
 * `navOrder` sits after Context Center (80) and before AI Studio / SQL Studio
 * (90+). Design wants Context Center visible by default: with Collate's extra
 * modules the default sidebar fills its `APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT`
 * (10) slots at Context Center, so Lineage overflows into "More" instead. A new
 * module sorting below 80 pushes Context Center back into "More".
 */
export const lineageModule: AppModule = {
  id: 'lineage',
  navOrder: 85,
  labelKey: 'label.lineage',
  icon: PlatformLineage,
  activeIcon: PlatformLineageActive,
  prefix: ROUTES.PLATFORM_LINEAGE,
  defaultPath: ROUTES.PLATFORM_LINEAGE,
  routes: [],
};
