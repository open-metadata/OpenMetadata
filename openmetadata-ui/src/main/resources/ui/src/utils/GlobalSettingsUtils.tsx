/*
 *  Copyright 2022 Collate
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

import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { camelCase } from 'lodash';
import React from 'react';
import SVGIcons from './SvgUtils';

export const getGlobalSettingMenus = (
  label: string,
  key: string,
  category?: string,
  icon?: React.ReactNode,
  children?: {
    label: string;
    isProtected: boolean;
    icon: string;
  }[],
  type?: string,
  hasAccess?: boolean
): {
  key: string;
  icon: React.ReactNode;
  children: ItemType[] | undefined;
  label: string;
  type: string | undefined;
} => {
  return {
    key: `${category}.${key}`,
    icon,
    children: children
      ? children
          .filter((menu) => (hasAccess ? menu : !menu.isProtected))
          .map(({ label, icon }) => {
            return getGlobalSettingMenus(
              label,
              camelCase(label),
              key,
              <SVGIcons alt={label} className="tw-w-4" icon={icon} />
            );
          })
      : undefined,
    label,
    type,
  };
};
