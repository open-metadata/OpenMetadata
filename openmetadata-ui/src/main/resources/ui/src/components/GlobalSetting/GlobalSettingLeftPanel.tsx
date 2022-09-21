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

import { Empty, Menu, MenuProps } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { camelCase } from 'lodash';
import React, { useMemo } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { GlobalSettingOptions } from '../../constants/globalSettings.constants';
import { TeamType } from '../../generated/entity/teams/team';
import {
  getGlobalSettingMenuItem,
  getGlobalSettingsMenuWithPermission,
  MenuList,
} from '../../utils/GlobalSettingsUtils';
import { getSettingPath, getTeamsWithFqnPath } from '../../utils/RouterUtils';
import LeftPanelCard from '../common/LeftPanelCard/LeftPanelCard';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';

const GlobalSettingLeftPanel = () => {
  const history = useHistory();
  const { tab, settingCategory } = useParams<{ [key: string]: string }>();

  const { permissions } = usePermissionProvider();

  const menuItems: ItemType[] = useMemo(
    () =>
      getGlobalSettingsMenuWithPermission(permissions).reduce(
        (acc: ItemType[], curr: MenuList) => {
          const menuItem = getGlobalSettingMenuItem(
            curr.category,
            camelCase(curr.category),
            '',
            '',
            curr.items,
            'group'
          );
          if (menuItem.children?.length) {
            return [...acc, menuItem];
          } else {
            return acc;
          }
        },
        [] as ItemType[]
      ),
    [permissions]
  );

  const onClick: MenuProps['onClick'] = (e) => {
    // As we are setting key as "category.option" and extracting here category and option
    const [category, option] = e.key.split('.');
    if (option === GlobalSettingOptions.TEAMS) {
      history.push(getTeamsWithFqnPath(TeamType.Organization));
    } else {
      history.push(getSettingPath(category, option));
    }
  };

  return menuItems.length ? (
    <LeftPanelCard id="settings">
      <Menu
        className="global-setting-left-panel"
        data-testid="global-setting-left-panel"
        items={menuItems}
        mode="inline"
        selectedKeys={[`${settingCategory}.${tab}`]}
        onClick={onClick}
      />
    </LeftPanelCard>
  ) : (
    <Empty className="tw-mt-8" />
  );
};

export default GlobalSettingLeftPanel;
