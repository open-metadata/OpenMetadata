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
import { ReactComponent as PlatformLineageIcon } from '../../../assets/svg/ic-platform-lineage.svg';
import { ROUTES } from '../../../constants/constants';
import { AppModule } from '../../platform/ai-shell/AppModule.types';

/**
 * Lineage module — the AI sidebar's entry to the main Lineage page. The page
 * itself is served by the shell's page-table fallback, like Explore; this
 * module only surfaces the sidebar icon and points it at `/lineage`.
 */
export const lineageModule: AppModule = {
  id: 'lineage',
  navOrder: 12,
  labelKey: 'label.lineage',
  icon: PlatformLineageIcon,
  prefix: ROUTES.PLATFORM_LINEAGE,
  defaultPath: ROUTES.PLATFORM_LINEAGE,
  routes: [],
};
