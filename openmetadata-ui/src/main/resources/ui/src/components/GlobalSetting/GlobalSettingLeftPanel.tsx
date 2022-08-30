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
import { AxiosError } from 'axios';
import { camelCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { GLOBAL_SETTING_PERMISSION_RESOURCES } from '../../constants/globalSettings.constants';
import {
  getGlobalSettingMenuItem,
  getGlobalSettingsMenuWithPermission,
  MenuList,
} from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  ResourceEntity,
  UIPermission,
} from '../PermissionProvider/PermissionProvider.interface';

const GlobalSettingLeftPanel = () => {
  const history = useHistory();
  const { tab, settingCategory } = useParams<{ [key: string]: string }>();
  const [settingResourcePermission, setSettingResourcePermission] =
    useState<UIPermission>({} as UIPermission);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { getResourcePermission } = usePermissionProvider();

  const fetchResourcesPermission = async (resource: ResourceEntity) => {
    setIsLoading(true);
    try {
      const response = await getResourcePermission(resource);
      setSettingResourcePermission((prev) => ({
        ...prev,
        [resource]: response,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const menuItems: ItemType[] = useMemo(
    () =>
      getGlobalSettingsMenuWithPermission(settingResourcePermission).reduce(
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
    [setSettingResourcePermission]
  );

  const onClick: MenuProps['onClick'] = (e) => {
    // As we are setting key as "category.option" and extracting here category and option
    const [category, option] = e.key.split('.');
    history.push(getSettingPath(category, option));
  };

  useEffect(() => {
    // TODO: This will make number of API calls, need to think of better solution
    GLOBAL_SETTING_PERMISSION_RESOURCES.forEach((resource) => {
      fetchResourcesPermission(resource);
    });
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      {menuItems.length ? (
        <Menu
          className="global-setting-left-panel"
          items={menuItems}
          mode="inline"
          selectedKeys={[`${settingCategory}.${tab}`]}
          onClick={onClick}
        />
      ) : null}
    </>
  );
};

export default GlobalSettingLeftPanel;
