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
import { Col, Menu, MenuProps, Row, Typography } from 'antd';
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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import './left-sidebar.less';

const LeftSidebar = () => {
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthContext();

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
          <div
            className="d-flex flex-col items-center"
            data-testid="governance">
            <GovernIcon className="m-0" width={30} />
            <Typography.Text className="left-panel-label">
              {t('label.govern', { lng: 'en-US' })}
            </Typography.Text>
          </div>
        ),
        children: [
          {
            key: 'glossary',
            label: (
              <NavLink
                className="no-underline"
                data-testid="appbar-item-glossary"
                to={{
                  pathname: ROUTES.GLOSSARY,
                }}>
                <span className="left-panel-item d-flex flex-col items-center">
                  <GlossaryIcon className="m-0" width={30} />
                  <Typography.Text className="left-panel-label">
                    {t('label.glossary', { lng: 'en-US' })}
                  </Typography.Text>
                </span>
              </NavLink>
            ),
          },
          {
            key: 'tags',
            label: (
              <NavLink
                className="no-underline"
                data-testid="appbar-item-tags"
                to={{
                  pathname: ROUTES.TAGS,
                }}>
                <div className="left-panel-item d-flex flex-col items-center">
                  <ClassificationIcon className="m-0" width={30} />
                  <Typography.Text className="left-panel-label">
                    {t('label.classification', { lng: 'en-US' })}
                  </Typography.Text>
                </div>
              </NavLink>
            ),
          },
        ],
      },
    ];
  }, []);

  return (
    <div className="d-flex flex-col justify-between h-full">
      <Row className="p-y-sm">
        <Col
          className={`left-panel-item p-md ${
            location.pathname.startsWith('/explore') ? 'active' : ''
          }`}
          span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-explore"
            to={{
              pathname: '/explore/tables',
            }}>
            <div className=" d-flex flex-col items-center">
              <ExploreIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.explore', { lng: 'en-US' })}
              </Typography.Text>
            </div>
          </NavLink>
        </Col>
        <Col
          className={`left-panel-item p-md ${
            location.pathname.includes(ROUTES.DATA_QUALITY) ? 'active' : ''
          }`}
          span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-data-quality"
            to={{
              pathname: ROUTES.DATA_QUALITY,
            }}>
            <div className="d-flex flex-col items-center">
              <QualityIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.quality', { lng: 'en-US' })}
              </Typography.Text>
            </div>
          </NavLink>
        </Col>
        <Col
          className={`left-panel-item p-md ${
            location.pathname.includes(ROUTES.DATA_INSIGHT) ? 'active' : ''
          }`}
          span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-data-insight"
            to={{
              pathname: ROUTES.DATA_INSIGHT,
            }}>
            <div className="d-flex flex-col items-center">
              <InsightsIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.insight-plural', { lng: 'en-US' })}
              </Typography.Text>
            </div>
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
        <Col
          className={`left-panel-item p-md ${
            location.pathname.startsWith('/settings') ? 'active' : ''
          }`}
          span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-settings"
            to={{
              pathname: ROUTES.SETTINGS,
            }}>
            <div className="d-flex flex-col items-center">
              <SettingsIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.setting-plural', { lng: 'en-US' })}
              </Typography.Text>
            </div>
          </NavLink>
        </Col>
        <Col className="left-panel-item p-md" span={24}>
          <div
            className="d-flex flex-col items-center cursor-pointer"
            data-testid="appbar-item-logout"
            onClick={() => onLogoutHandler()}>
            <LogoutIcon className="m-0" width={30} />
            <Typography.Text className="left-panel-label">
              {t('label.logout', { lng: 'en-US' })}
            </Typography.Text>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default LeftSidebar;
