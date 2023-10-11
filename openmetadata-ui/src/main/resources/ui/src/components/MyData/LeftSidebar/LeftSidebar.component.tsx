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
import { Button, Col, Menu, MenuProps, Row, Tooltip, Typography } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { ReactComponent as GovernIcon } from '../../../assets/svg/bank.svg';
import { ReactComponent as LogoutIcon } from '../../../assets/svg/logout.svg';
import { useAuthContext } from '../../../components/authentication/auth-provider/AuthProvider';
import {
  SETTING_ITEM,
  SIDEBAR_GOVERN_LIST,
  SIDEBAR_LIST,
} from '../../../constants/LeftSidebar.constants';
import { useApplicationConfigProvider } from '../../ApplicationConfigProvider/ApplicationConfigProvider';
import './left-sidebar.less';
import LeftSidebarItem from './LeftSidebarItem.component';

const LeftSidebar = () => {
  const { sideBarElements } = useApplicationConfigProvider();
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthContext();
  const [showConfirmLogoutModal, setShowConfirmLogoutModal] = useState(false);

  const subMenuItemSelected = useMemo(() => {
    if (location.pathname.startsWith('/glossary')) {
      return ['glossary'];
    } else if (location.pathname.startsWith('/tags')) {
      return ['tags'];
    }

    return [];
  }, [location.pathname]);

  const items: MenuProps['items'] = useMemo(() => {
    return [
      {
        key: 'governance',
        popupClassName: 'govern-menu',
        label: (
          <Tooltip
            overlayClassName="left-panel-tooltip"
            placement="topLeft"
            title={
              <Typography.Text className="left-panel-label">
                {t('label.govern')}
              </Typography.Text>
            }>
            <GovernIcon data-testid="governance" width={30} />
          </Tooltip>
        ),
        children: SIDEBAR_GOVERN_LIST.map(
          ({ key, label, icon, redirect_url, dataTestId }) => {
            const Icon = icon;

            return {
              key,
              label: (
                <Tooltip
                  overlayClassName="left-panel-tooltip"
                  placement="right"
                  title={
                    <Typography.Text className="left-panel-label">
                      {label}
                    </Typography.Text>
                  }>
                  <NavLink
                    className="no-underline d-flex justify-center"
                    data-testid={dataTestId}
                    to={{
                      pathname: redirect_url,
                    }}>
                    <Icon className="left-panel-item p-y-sm" width={30} />
                  </NavLink>
                </Tooltip>
              ),
            };
          }
        ),
      },
    ];
  }, []);

  const handleLogoutClick = () => {
    setShowConfirmLogoutModal(true);
  };

  const hideConfirmationModal = () => {
    setShowConfirmLogoutModal(false);
  };

  return (
    <div className="d-flex flex-col justify-between h-full">
      <Row className="p-y-sm">
        {SIDEBAR_LIST.map((item) => (
          <Col key={item.key} span={24}>
            <LeftSidebarItem data={item} />
          </Col>
        ))}
        <Menu
          className="left-panel-item"
          items={items}
          mode="vertical"
          selectedKeys={subMenuItemSelected}
          triggerSubMenuAction="click"
        />
        {sideBarElements}
      </Row>
      <Row className="p-y-sm">
        <Col span={24}>
          <LeftSidebarItem data={SETTING_ITEM} />
        </Col>
        <Col span={24}>
          <Tooltip
            overlayClassName="left-panel-tooltip"
            placement="right"
            title={
              <Typography.Text className="left-panel-label">
                {t('label.logout')}
              </Typography.Text>
            }>
            <div
              className="left-panel-item"
              data-testid="app-bar-item-logout"
              onClick={handleLogoutClick}>
              <LogoutIcon className="m-0" width={30} />
            </div>
          </Tooltip>
        </Col>
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
