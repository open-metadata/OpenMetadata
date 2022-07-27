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

import { Menu, MenuProps } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { camelCase } from 'lodash';
import React from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { GLOBAL_SETTINGS_MENU } from '../../constants/globalSettings.constants';
import { getGlobalSettingMenus } from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';

const GlobalSettingLeftPanel = () => {
  const { tab, settingCategory } = useParams<{ [key: string]: string }>();

  const history = useHistory();
  const items: ItemType[] = GLOBAL_SETTINGS_MENU.map(({ category, items }) => {
    return getGlobalSettingMenus(
      category,
      camelCase(category),
      '',
      items,
      'group'
    );
  });

  const onClick: MenuProps['onClick'] = (e) => {
    // As we are setting key as "category.option" and extracting here category and option
    const [category, option] = e.key.split('.');
    history.push(getSettingPath(category, option));
  };

  return (
    <Menu
      className="global-setting-left-panel"
      items={items}
      mode="inline"
      selectedKeys={[`${settingCategory}.${tab}`]}
      onClick={onClick}
    />
  );
};

export default GlobalSettingLeftPanel;
