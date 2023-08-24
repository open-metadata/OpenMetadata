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
import { ReactComponent as GovernIcon } from 'assets/svg/bank.svg';
import { ReactComponent as ClassificationIcon } from 'assets/svg/classification.svg';
import { ReactComponent as ExploreIcon } from 'assets/svg/globalsearch.svg';
import { ReactComponent as GlossaryIcon } from 'assets/svg/glossary.svg';
import { ReactComponent as QualityIcon } from 'assets/svg/ic-quality-v1.svg';
import { ReactComponent as SettingsIcon } from 'assets/svg/ic-settings-v1.svg';
import { ReactComponent as InsightsIcon } from 'assets/svg/lampcharge.svg';
import { ReactComponent as LogoutIcon } from 'assets/svg/logout.svg';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import { ROUTES } from 'constants/constants';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import './left-sidebar.less';

const LeftSidebar = () => {
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
            placement="right"
            title={
              <Typography.Text className="left-panel-label">
                {t('label.govern')}
              </Typography.Text>
            }>
            <div
              className="d-flex flex-col items-center"
              data-testid="governance">
              <GovernIcon className="m-0" width={30} />
            </div>
          </Tooltip>
        ),
        children: [
          {
            key: 'glossary',
            label: (
              <Tooltip
                overlayClassName="left-panel-tooltip"
                placement="right"
                title={
                  <Typography.Text className="left-panel-label">
                    {t('label.glossary')}
                  </Typography.Text>
                }>
                <NavLink
                  className="no-underline"
                  data-testid="appbar-item-glossary"
                  to={{
                    pathname: ROUTES.GLOSSARY,
                  }}>
                  <span className="left-panel-item p-y-xss">
                    <GlossaryIcon className="m-0" width={30} />
                  </span>
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: 'tags',
            label: (
              <Tooltip
                overlayClassName="left-panel-tooltip"
                placement="right"
                title={
                  <Typography.Text className="left-panel-label">
                    {t('label.classification')}
                  </Typography.Text>
                }>
                <NavLink
                  className="no-underline"
                  data-testid="appbar-item-tags"
                  to={{
                    pathname: ROUTES.TAGS,
                  }}>
                  <div className="left-panel-item p-y-xss">
                    <ClassificationIcon className="m-0" width={30} />
                  </div>
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
    ];
  }, []);

  const handleLogoutClick = () => {
    setShowConfirmLogoutModal(true);
  };

  const hideCofirmationModal = () => {
    setShowConfirmLogoutModal(false);
  };

  return (
    <div className="d-flex flex-col justify-between h-full">
      <Row className="p-y-sm">
        <Col span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-explore"
            to={{
              pathname: '/explore/tables',
            }}>
            <Tooltip
              overlayClassName="left-panel-tooltip"
              placement="right"
              title={
                <Typography.Text className="left-panel-label">
                  {t('label.explore')}
                </Typography.Text>
              }>
              <div
                className={`left-panel-item  ${
                  location.pathname.startsWith('/explore') ? 'active' : ''
                }`}>
                <ExploreIcon className="m-0" width={30} />
              </div>
            </Tooltip>
          </NavLink>
        </Col>
        <Col span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-data-quality"
            to={{
              pathname: ROUTES.DATA_QUALITY,
            }}>
            <Tooltip
              overlayClassName="left-panel-tooltip"
              placement="right"
              title={
                <Typography.Text className="left-panel-label">
                  {t('label.quality')}
                </Typography.Text>
              }>
              <div
                className={`left-panel-item  ${
                  location.pathname.includes(ROUTES.DATA_QUALITY)
                    ? 'active'
                    : ''
                }`}>
                <QualityIcon className="m-0" width={30} />
              </div>
            </Tooltip>
          </NavLink>
        </Col>
        <Col span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-data-insight"
            to={{
              pathname: ROUTES.DATA_INSIGHT,
            }}>
            <Tooltip
              overlayClassName="left-panel-tooltip"
              placement="right"
              title={
                <Typography.Text className="left-panel-label">
                  {t('label.insight-plural')}
                </Typography.Text>
              }>
              <div
                className={`left-panel-item  ${
                  location.pathname.includes(ROUTES.DATA_INSIGHT)
                    ? 'active'
                    : ''
                }`}>
                <InsightsIcon className="m-0" width={30} />
              </div>
            </Tooltip>
          </NavLink>
        </Col>
        <Menu
          className="left-panel-item"
          items={items}
          mode="vertical"
          selectedKeys={subMenuItemSelected}
          triggerSubMenuAction="click"
        />
      </Row>
      <Row className="p-y-sm">
        <Col span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-settings"
            to={{
              pathname: ROUTES.SETTINGS,
            }}>
            <Tooltip
              overlayClassName="left-panel-tooltip"
              placement="right"
              title={
                <Typography.Text className="left-panel-label">
                  {t('label.setting-plural')}
                </Typography.Text>
              }>
              <div
                className={`left-panel-item  ${
                  location.pathname.startsWith('/settings') ? 'active' : ''
                }`}>
                <SettingsIcon className="m-0" width={30} />
              </div>
            </Tooltip>
          </NavLink>
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
              className="left-panel-item cursor-pointer"
              data-testid="appbar-item-logout"
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
          onCancel={hideCofirmationModal}>
          <Typography.Title level={5}>{t('label.logout')}</Typography.Title>
          <Typography.Text className="text-grey-muted">
            {t('message.logout-confirmation')}
          </Typography.Text>

          <div className="d-flex gap-2 w-full m-t-md justify-center">
            <Button className="confirm-btn" onClick={hideCofirmationModal}>
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
