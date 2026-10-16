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

import { Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../utils/common/layout.utils';

import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import SettingItemCard from '../../components/Settings/SettingItemCard/SettingItemCard.component';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { useAuth } from '../../hooks/authHooks';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import globalSettingsClassBase from '../../utils/GlobalSettingsClassBase';
import {
  getGlobalSettingMenuItem,
  SettingMenuItem,
} from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import './global-setting-page.style.less';

const GlobalSettingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const authProvider = useApplicationStore(
    (state) => state.authConfig?.provider
  );

  const settingItems = useMemo(
    () =>
      globalSettingsClassBase
        .getGlobalSettingsMenuWithPermission(
          permissions,
          isAdminUser,
          authProvider
        )
        .filter((curr: SettingMenuItem) => {
          const menuItem = getGlobalSettingMenuItem(curr);

          if (!isUndefined(menuItem.isProtected)) {
            return menuItem.isProtected;
          }

          if (menuItem.items && menuItem.items.length > 0) {
            return true;
          }

          return false;
        }),
    [permissions, isAdminUser, authProvider]
  );

  const handleSettingItemClick = useCallback((category: string) => {
    // Handle special case for nested menu items
    if (category.includes('.')) {
      const [cat, option] = category.split('.');
      navigate(getSettingPath(cat, option));
    } else {
      navigate(getSettingPath(category));
    }
  }, []);

  if (isEmpty(settingItems)) {
    return (
      <ErrorPlaceHolder
        className="border-none h-min-80"
        permissionValue={t('label.setting-plural')}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.setting-plural')}>
      <Grid
        className="layout-row layout-grid m-t-xs"
        style={{ ...getLayoutGutter(0, 20) }}>
        <Grid.Item className="layout-column" span={24}>
          <PageHeader
            data={{
              header: t(PAGE_HEADERS.SETTING.header),
              subHeader: t(PAGE_HEADERS.SETTING.subHeader),
            }}
            learningPageId={LEARNING_PAGE_IDS.SETTINGS}
            title={t('label.setting-plural')}
          />
        </Grid.Item>

        <Grid.Item className="layout-column" span={24}>
          <Grid
            className="layout-row layout-grid setting-items-container"
            style={{ ...getLayoutGutter(20, 20) }}>
            {settingItems.map((setting) => (
              <Grid.Item
                className="layout-column tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-12 tw:min-[992px]:col-span-8"
                key={setting?.key}>
                <SettingItemCard
                  className="global-setting-card"
                  data={setting}
                  onClick={handleSettingItemClick}
                />
              </Grid.Item>
            ))}
          </Grid>
        </Grid.Item>
      </Grid>
    </PageLayoutV1>
  );
};

export default GlobalSettingPage;
