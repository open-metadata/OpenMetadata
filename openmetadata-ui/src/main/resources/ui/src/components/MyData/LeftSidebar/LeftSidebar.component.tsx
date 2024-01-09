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
import { Button, Col, Menu, Row, Tooltip, Typography } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LogoutIcon } from '../../../assets/svg/logout.svg';
import { SETTING_ITEM } from '../../../constants/LeftSidebar.constants';
import leftSidebarClassBase from '../../../utils/LeftSidebarClassBase';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import './left-sidebar.less';
import LeftSidebarItem from './LeftSidebarItem.component';

const LeftSidebar = () => {
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthContext();
  const [showConfirmLogoutModal, setShowConfirmLogoutModal] = useState(false);

  const subMenuItemSelected = useMemo(() => {
    if (location.pathname.startsWith('/glossary')) {
      return ['glossary'];
    } else if (location.pathname.startsWith('/tags')) {
      return ['tags'];
    } else if (location.pathname.startsWith('/incident-manager')) {
      return ['incident-manager'];
    } else if (location.pathname.startsWith('/data-quality')) {
      return ['data-contract'];
    }

    return [];
  }, [location.pathname]);

  const sideBarItems = leftSidebarClassBase.getSidebarItems();
  const SideBarElements = leftSidebarClassBase.getSidebarElements();

  const handleLogoutClick = () => {
    setShowConfirmLogoutModal(true);
  };

  const hideConfirmationModal = () => {
    setShowConfirmLogoutModal(false);
  };

  return (
    <div className="d-flex flex-col justify-between h-full">
      <Row className="p-y-sm">
        {sideBarItems.map((item) => {
          const Icon = item.icon;

          return (
            <Col key={item.key} span={24}>
              {item.children ? (
                <Menu
                  className="left-panel-item"
                  items={[
                    {
                      key: item.key,
                      popupClassName: 'govern-menu',
                      label: (
                        <Tooltip
                          overlayClassName="left-panel-tooltip"
                          placement="topLeft"
                          title={
                            <Typography.Text className="left-panel-label">
                              {item.label}
                            </Typography.Text>
                          }>
                          <Icon data-testid={item.dataTestId} width={30} />
                        </Tooltip>
                      ),
                      children: item.children.map((child) => {
                        return {
                          key: child.key,
                          label: <LeftSidebarItem data={child} />,
                        };
                      }),
                    },
                  ]}
                  mode="vertical"
                  selectedKeys={subMenuItemSelected}
                  triggerSubMenuAction="click"
                />
              ) : (
                <LeftSidebarItem data={item} />
              )}
            </Col>
          );
        })}

        {SideBarElements && <SideBarElements />}
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
