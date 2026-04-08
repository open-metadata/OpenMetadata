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
  NavItemDividerType,
  NavItemType,
} from '@openmetadata/ui-core-components';
import {
  Building02,
  Cube01,
  Globe01,
  Home02,
  Settings01,
} from '@untitledui/icons';
import { TFunction } from 'i18next';
import { ROUTES } from './constants';

export const CUSTOM_SIDEBAR_ROUTES = [ROUTES.DATA_MARKETPLACE];

export interface SidebarConfig {
  items: (NavItemType | NavItemDividerType)[];
  bottomItems?: (NavItemType | NavItemDividerType)[];
}

export const getMarketplaceSidebarConfig = (t: TFunction): SidebarConfig => ({
  items: [
    { label: t('label.home'), href: ROUTES.MY_DATA, icon: Home02 },
    {
      label: t('label.data-marketplace'),
      href: ROUTES.DATA_MARKETPLACE,
      icon: Building02,
    },
    {
      label: t('label.data-product-plural'),
      href: `${ROUTES.DATA_MARKETPLACE}/data-products`,
      icon: Cube01,
    },
    {
      label: t('label.domain-plural'),
      href: `${ROUTES.DATA_MARKETPLACE}/domains`,
      icon: Globe01,
    },
  ],
  bottomItems: [
    {
      label: t('label.setting-plural'),
      href: ROUTES.SETTINGS,
      icon: Settings01,
    },
  ],
});
