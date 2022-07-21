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

export const getGlobalSettingMenus = (
  label: string,
  key: string,
  children?: string[],
  type?: string
): {
  key: string;
  children: ItemType[] | undefined;
  label: string;
  type: string | undefined;
} => {
  return {
    key,
    children: children
      ? children.map((child) => getGlobalSettingMenus(child, camelCase(child)))
      : undefined,
    label,
    type,
  };
};
