/*
 *  Copyright 2022 Collate.
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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { TeamType } from '../../generated/entity/teams/team';
import { useAuth } from '../../hooks/authHooks';
import {
  getGlobalSettingMenuItem,
  getGlobalSettingsMenuWithPermission,
  MenuList,
} from '../../utils/GlobalSettingsUtils';
import { getSettingPath, getTeamsWithFqnPath } from '../../utils/RouterUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import LeftPanelCard from '../common/LeftPanelCard/LeftPanelCard';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';

const GlobalSettingLeftPanel = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { tab, settingCategory } = useParams<{ [key: string]: string }>();

  const { permissions } = usePermissionProvider();

  const { isAdminUser } = useAuth();

  const menuItems: ItemType[] = useMemo(
    () =>
      getGlobalSettingsMenuWithPermission(permissions, isAdminUser).reduce(
        (acc: ItemType[], curr: MenuList) => {
          const menuItem = getGlobalSettingMenuItem(
            curr.category,
            camelCase(curr.category),
            '',
            '',
            curr.items,
            'group',
            curr.isBeta
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
        className="custom-menu"
        data-testid="global-setting-left-panel"
        items={menuItems}
        mode="inline"
        selectedKeys={[`${settingCategory}.${tab}`]}
        onClick={onClick}
      />
    </LeftPanelCard>
  ) : (
    <ErrorPlaceHolder>
      <p>{t('message.no-data-available')}</p>
    </ErrorPlaceHolder>
  );
};

export default GlobalSettingLeftPanel;
