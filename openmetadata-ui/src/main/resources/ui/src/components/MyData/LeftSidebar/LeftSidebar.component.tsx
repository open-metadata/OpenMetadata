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
import { Col, Menu, Row, Typography } from 'antd';
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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { activeLink, normalLink } from 'utils/styleconstant';
import './left-sidebar.less';

const navStyle = (value: boolean) => {
  if (value) {
    return { color: activeLink };
  }

  return { color: normalLink };
};

const LeftSidebar = () => {
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthContext();

  return (
    <div className="d-flex flex-col justify-between h-full">
      <Row className="p-y-sm">
        <Col className="left-panel-item p-md" span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-explore"
            style={navStyle(location.pathname.startsWith('/explore'))}
            to={{
              pathname: '/explore/tables',
            }}>
            <div className=" d-flex flex-col items-center">
              <ExploreIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.explore')}
              </Typography.Text>
            </div>
          </NavLink>
        </Col>
        <Col className="left-panel-item p-md" span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-data-quality"
            style={navStyle(location.pathname.includes(ROUTES.TEST_SUITES))}
            to={{
              pathname: ROUTES.TEST_SUITES,
            }}>
            <div className="d-flex flex-col items-center">
              <QualityIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.quality')}
              </Typography.Text>
            </div>
          </NavLink>
        </Col>
        <Col className="left-panel-item p-md" span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-data-insight"
            style={navStyle(location.pathname.includes(ROUTES.DATA_INSIGHT))}
            to={{
              pathname: ROUTES.DATA_INSIGHT,
            }}>
            <div className="d-flex flex-col items-center">
              <InsightsIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.insight-plural')}
              </Typography.Text>
            </div>
          </NavLink>
        </Col>
        <Menu className="left-panel-item" mode="vertical">
          <Menu.SubMenu
            data-testid="governance"
            key="governance"
            popupClassName="govern-menu"
            title={
              <>
                <GovernIcon className="m-0" width={30} />
                <Typography.Text className="left-panel-label">
                  {t('label.govern')}
                </Typography.Text>
              </>
            }>
            <Menu.Item className="left-panel-item" key="glossary">
              <NavLink
                className="no-underline"
                data-testid="appbar-item-glossary"
                style={navStyle(location.pathname.startsWith('/glossary'))}
                to={{
                  pathname: ROUTES.GLOSSARY,
                }}>
                <div className="d-flex flex-col items-center">
                  <GlossaryIcon className="m-0" width={30} />
                  <Typography.Text className="left-panel-label">
                    {t('label.glossary')}
                  </Typography.Text>
                </div>
              </NavLink>
            </Menu.Item>
            <Menu.Item className="left-panel-item" key="tags">
              <NavLink
                className="no-underline"
                data-testid="appbar-item-tags"
                style={navStyle(location.pathname.startsWith('/tags'))}
                to={{
                  pathname: ROUTES.TAGS,
                }}>
                <div className="left-panel-item d-flex flex-col items-center">
                  <ClassificationIcon className="m-0" width={30} />
                  <Typography.Text className="left-panel-label">
                    {t('label.classification')}
                  </Typography.Text>
                </div>
              </NavLink>
            </Menu.Item>
          </Menu.SubMenu>
        </Menu>
      </Row>
      <Row className="p-y-sm">
        <Col className="left-panel-item p-md" span={24}>
          <NavLink
            className="no-underline"
            data-testid="appbar-item-settings"
            style={navStyle(location.pathname.startsWith('/settings'))}
            to={{
              pathname: ROUTES.SETTINGS,
            }}>
            <div className="d-flex flex-col items-center">
              <SettingsIcon className="m-0" width={30} />
              <Typography.Text className="left-panel-label">
                {t('label.setting-plural')}
              </Typography.Text>
            </div>
          </NavLink>
        </Col>
        <Col className="left-panel-item p-md" span={24}>
          <div
            className="d-flex flex-col items-center cursor-pointer"
            onClick={() => onLogoutHandler()}>
            <LogoutIcon className="m-0" width={30} />
            <Typography.Text className="left-panel-label">
              {t('label.logout')}
            </Typography.Text>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default LeftSidebar;
