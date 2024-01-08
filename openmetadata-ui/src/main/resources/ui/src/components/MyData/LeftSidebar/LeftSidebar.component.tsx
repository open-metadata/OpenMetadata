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
import { Button, Col, Menu, MenuProps, Row, Typography } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import classNames from 'classnames';
import { noop } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import {
  GOVERN_ITEM,
  LOGOUT_ITEM,
  SETTING_ITEM,
  SIDEBAR_GOVERN_LIST,
} from '../../../constants/LeftSidebar.constants';
import leftSidebarClassBase from '../../../utils/LeftSidebarClassBase';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import BrandImage from '../../common/BrandImage/BrandImage';
import './left-sidebar.less';
import LeftSidebarItem from './LeftSidebarItem.component';

const LeftSidebar = () => {
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthContext();
  const [showConfirmLogoutModal, setShowConfirmLogoutModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);

  const sideBarItems = leftSidebarClassBase.getSidebarItems();

  const selectedKeys = useMemo(() => {
    const pathArray = location.pathname.split('/').splice(0, 2).join('/');

    return [pathArray];
  }, [location.pathname]);

  const handleLogoutClick = useCallback(() => {
    setShowConfirmLogoutModal(true);
  }, []);

  const hideConfirmationModal = () => {
    setShowConfirmLogoutModal(false);
  };

  const TOP_SIDEBAR_MENU_ITEMS: MenuProps['items'] = useMemo(() => {
    return [
      ...sideBarItems.map((item) => {
        return {
          key: item.key,
          label: <LeftSidebarItem data={item} />,
        };
      }),
      {
        key: GOVERN_ITEM.key,
        label: <LeftSidebarItem data={GOVERN_ITEM} />,
        children: SIDEBAR_GOVERN_LIST.map((item) => {
          return {
            key: item.key,
            label: <LeftSidebarItem data={item} />,
          };
        }),
      },
    ];
  }, []);

  const LOWER_SIDEBAR_TOP_SIDEBAR_MENU_ITEMS: MenuProps['items'] = useMemo(
    () =>
      [SETTING_ITEM, LOGOUT_ITEM].map((item) => ({
        key: item.key,
        label: (
          <LeftSidebarItem
            data={{
              ...item,
              onClick: ROUTES.LOGOUT === item.key ? handleLogoutClick : noop,
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

  return (
    <div
      className={classNames(
        'd-flex flex-col justify-between h-full left-sidebar-container',
        { 'sidebar-open': !isSidebarCollapsed }
      )}
      data-testid="left-sidebar"
      onMouseLeave={handleMouseOut}
      onMouseOver={handleMouseOver}>
      <Row className="p-b-sm">
        <Col className="brand-logo-container" span={24}>
          <Link className="flex-shrink-0" id="openmetadata_logo" to="/">
            <BrandImage
              alt="OpenMetadata Logo"
              className="vertical-middle"
              dataTestId="image"
              height={isSidebarCollapsed ? 30 : 34}
              isMonoGram={isSidebarCollapsed}
              width={isSidebarCollapsed ? 30 : 120}
            />
          </Link>
        </Col>

        <Col className="w-full">
          <Menu
            inlineCollapsed
            items={TOP_SIDEBAR_MENU_ITEMS}
            mode="inline"
            rootClassName="left-sidebar-menu"
            selectedKeys={selectedKeys}
            subMenuCloseDelay={1}
          />
        </Col>
      </Row>

      <Row className="p-y-sm">
        <Menu
          inlineCollapsed
          items={LOWER_SIDEBAR_TOP_SIDEBAR_MENU_ITEMS}
          mode="inline"
          rootClassName="left-sidebar-menu"
          selectedKeys={selectedKeys}
        />
      </Row>
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
    </div>
  );
};

export default LeftSidebar;
