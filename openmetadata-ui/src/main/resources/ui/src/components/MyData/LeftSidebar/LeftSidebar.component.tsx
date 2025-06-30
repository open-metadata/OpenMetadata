/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Layout, Menu, MenuProps, Typography } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import classNames from 'classnames';
import { noop } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  LOGOUT_ITEM,
  SETTING_ITEM,
  SIDEBAR_NESTED_KEYS,
} from '../../../constants/LeftSidebar.constants';
import { SidebarItem } from '../../../enums/sidebar.enum';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { filterHiddenNavigationItems } from '../../../utils/CustomizaNavigation/CustomizeNavigation';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import BrandImage from '../../common/BrandImage/BrandImage';
import './left-sidebar.less';
import { LeftSidebarItem as LeftSidebarItemType } from './LeftSidebar.interface';
import LeftSidebarItem from './LeftSidebarItem.component';
const { Sider } = Layout;

const LeftSidebar = () => {
  const location = useCustomLocation();
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthProvider();
  const [showConfirmLogoutModal, setShowConfirmLogoutModal] = useState(false);
  const {
    preferences: { isSidebarCollapsed },
  } = useCurrentUserPreferences();

  const { i18n } = useTranslation();
  const isDirectionRTL = useMemo(() => i18n.dir() === 'rtl', [i18n]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const { navigation } = useCustomPages('Navigation');

  const sideBarItems = useMemo(
    () => filterHiddenNavigationItems(navigation),
    [navigation]
  );

  const selectedKeys = useMemo(() => {
    const pathArray = location.pathname.split('/');
    const deepPath = [...pathArray].splice(0, 3).join('/');

    return SIDEBAR_NESTED_KEYS[deepPath]
      ? [deepPath]
      : [pathArray.splice(0, 2).join('/')];
  }, [location.pathname]);

  const handleLogoutClick = useCallback(() => {
    setShowConfirmLogoutModal(true);
  }, []);

  const hideConfirmationModal = () => {
    setShowConfirmLogoutModal(false);
  };

  const LOWER_SIDEBAR_TOP_SIDEBAR_MENU_ITEMS: MenuProps['items'] = useMemo(
    () =>
      [SETTING_ITEM, LOGOUT_ITEM].map((item) => ({
        key: item.key,
        icon: <Icon component={item.icon} />,
        onClick: item.key === SidebarItem.LOGOUT ? handleLogoutClick : noop,
        label: <LeftSidebarItem data={item} />,
      })),
    [handleLogoutClick]
  );

  const menuItems = useMemo(() => {
    return [
      ...sideBarItems.map((item) => {
        return {
          key: item.key,
          icon: <Icon component={item.icon} />,
          label: <LeftSidebarItem data={item} />,
          children: item.children?.map((item: LeftSidebarItemType) => {
            return {
              key: item.key,
              icon: <Icon component={item.icon} />,
              label: <LeftSidebarItem data={item} />,
            };
          }),
        };
      }),
    ];
  }, [sideBarItems]);

  const handleMenuClick: MenuProps['onClick'] = useCallback(() => {
    setOpenKeys([]);
  }, []);

  return (
    <Sider
      collapsible
      className={classNames({
        'left-sidebar-col-rtl': isDirectionRTL,
        'sidebar-open': !isSidebarCollapsed,
      })}
      collapsed={isSidebarCollapsed}
      collapsedWidth={72}
      data-testid="left-sidebar"
      trigger={null}
      width={228}>
      <div className="logo-container">
        <Link className="flex-shrink-0" id="openmetadata_logo" to="/">
          <BrandImage
            alt="OpenMetadata Logo"
            className="vertical-middle"
            dataTestId="image"
            height={40}
            isMonoGram={isSidebarCollapsed}
            width="auto"
          />
        </Link>
      </div>

      <div className="left-sidebar-layout">
        <div className="menu-container">
          <div className="top-menu">
            <Menu
              inlineIndent={16}
              items={menuItems}
              mode="inline"
              openKeys={openKeys}
              rootClassName="left-sidebar-menu"
              selectedKeys={selectedKeys}
              onClick={handleMenuClick}
              onOpenChange={setOpenKeys}
            />
          </div>

          <div className="bottom-menu">
            <Menu
              inlineIndent={16}
              items={[
                {
                  type: 'divider',
                  style: {
                    margin: '8px 0',
                  },
                },
                ...LOWER_SIDEBAR_TOP_SIDEBAR_MENU_ITEMS,
              ]}
              mode="inline"
              rootClassName="left-sidebar-menu"
              selectedKeys={selectedKeys}
            />
          </div>
        </div>
      </div>

      {showConfirmLogoutModal && (
        <Modal
          centered
          bodyStyle={{ textAlign: 'center' }}
          closable={false}
          closeIcon={null}
          footer={null}
          open={showConfirmLogoutModal}
          width={360}
          onCancel={hideConfirmationModal}>
          <Typography.Title level={5}>{t('label.logout')}</Typography.Title>
          <Typography.Text className="text-grey-muted">
            {t('message.logout-confirmation')}
          </Typography.Text>

          <div className="d-flex gap-2 w-full m-t-md justify-center">
            <Button className="confirm-btn" onClick={hideConfirmationModal}>
              {t('label.cancel')}
            </Button>
            <Button
              className="confirm-btn"
              data-testid="confirm-logout"
              type="primary"
              onClick={onLogoutHandler}>
              {t('label.logout')}
            </Button>
          </div>
        </Modal>
      )}
    </Sider>
  );
};

export default LeftSidebar;
