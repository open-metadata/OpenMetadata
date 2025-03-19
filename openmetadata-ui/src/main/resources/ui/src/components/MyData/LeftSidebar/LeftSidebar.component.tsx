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
import { MenuItemType } from 'antd/lib/menu/hooks/useItems';
import Modal from 'antd/lib/modal/Modal';
import classNames from 'classnames';
import { isEmpty, noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  LOGOUT_ITEM,
  SETTING_ITEM,
  SIDEBAR_NESTED_KEYS,
} from '../../../constants/LeftSidebar.constants';
import { EntityType } from '../../../enums/entity.enum';
import { SidebarItem } from '../../../enums/sidebar.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import { getDocumentByFQN } from '../../../rest/DocStoreAPI';
import {
  filterAndArrangeTreeByKeys,
  getNestedKeysFromNavigationItems,
} from '../../../utils/CustomizaNavigation/CustomizeNavigation';
import leftSidebarClassBase from '../../../utils/LeftSidebarClassBase';
import BrandImage from '../../common/BrandImage/BrandImage';
import './left-sidebar.less';
import { LeftSidebarItem as LeftSidebarItemType } from './LeftSidebar.interface';
import LeftSidebarItem from './LeftSidebarItem.component';

const { Sider } = Layout;

const LeftSidebar = () => {
  const location = useCustomLocation();
  const { t } = useTranslation();
  const { onLogoutHandler } = useApplicationStore();
  const [showConfirmLogoutModal, setShowConfirmLogoutModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const { selectedPersona } = useApplicationStore();
  const { i18n } = useTranslation();
  const isDirectionRTL = useMemo(() => i18n.dir() === 'rtl', [i18n]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const { currentPersonaDocStore, setCurrentPersonaDocStore } =
    useCustomizeStore();

  const navigationItems = useMemo(() => {
    return currentPersonaDocStore?.data?.navigation;
  }, [currentPersonaDocStore]);

  const sideBarItems = isEmpty(navigationItems)
    ? leftSidebarClassBase.getSidebarItems()
    : filterAndArrangeTreeByKeys(
        leftSidebarClassBase.getSidebarItems(),
        getNestedKeysFromNavigationItems(navigationItems)
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
        label: (
          <LeftSidebarItem
            data={{
              ...item,
              onClick:
                item.key === SidebarItem.LOGOUT ? handleLogoutClick : noop,
            }}
          />
        ),
      })),
    [handleLogoutClick]
  );

  const handleMouseOver = useCallback(() => {
    if (!isSidebarCollapsed) {
      return;
    }
    setIsSidebarCollapsed(false);
  }, [isSidebarCollapsed]);

  const handleMouseOut = useCallback(() => {
    setIsSidebarCollapsed(true);
  }, []);

  const fetchCustomizedDocStore = useCallback(async (personaFqn: string) => {
    try {
      const pageLayoutFQN = `${EntityType.PERSONA}.${personaFqn}`;

      const document = await getDocumentByFQN(pageLayoutFQN);
      setCurrentPersonaDocStore(document);
    } catch (error) {
      // silent error
    }
  }, []);

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
      {
        type: 'divider',
      },
      ...LOWER_SIDEBAR_TOP_SIDEBAR_MENU_ITEMS,
    ];
  }, [sideBarItems]);

  useEffect(() => {
    if (selectedPersona.fullyQualifiedName) {
      fetchCustomizedDocStore(selectedPersona.fullyQualifiedName);
    }
  }, [selectedPersona]);

  const handleMenuClick: MenuProps['onClick'] = useCallback(() => {
    setIsSidebarCollapsed(true);
    setOpenKeys([]);
  }, []);

  return (
    <Sider
      collapsible
      className={classNames('left-sidebar-col left-sidebar-container', {
        'left-sidebar-col-rtl': isDirectionRTL,
        'sidebar-open': !isSidebarCollapsed,
      })}
      collapsed={isSidebarCollapsed}
      collapsedWidth={84}
      data-testid="left-sidebar"
      trigger={null}
      width={228}
      onMouseEnter={handleMouseOver}
      onMouseLeave={handleMouseOut}>
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

      <Menu
        inlineIndent={16}
        items={menuItems as MenuItemType[]}
        mode="inline"
        openKeys={openKeys}
        rootClassName="left-sidebar-menu"
        selectedKeys={selectedKeys}
        subMenuCloseDelay={1}
        onClick={handleMenuClick}
        onOpenChange={setOpenKeys}
      />

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
