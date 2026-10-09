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
    AssetsOwned,
    Building01,
    Building02,
    GridView,
    Home02,
    Menu03 as MenuIcon,
    Stars01
} from '@openmetadata/ui-core-components/icons';

/**
 * Core-ui icon overrides for the persona customize categories, used by the
 * card grid and the customize-view header. Keys match
 * `getCustomizePageCategories()`; a missing key falls back to that category's
 * default icon.
 */
export const PERSONA_CATEGORY_ICONS: Record<string, SvgComponent> = {
  navigation: MenuIcon,
  'app-layout': GridView,
  askCollateSidebar: Stars01,
  governance: Building01,
  'data-assets': AssetsOwned,
  DataMarketplace: Building02,
  LandingPage: Home02,
};
