/* eslint-disable i18next/no-literal-string */
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
import { Layout } from 'antd';
import classNames from 'classnames';
import { useCallback, useEffect } from 'react';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { LineageSettings } from '../../generated/configuration/lineageSettings';
import { SettingType } from '../../generated/settings/settings';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getLimitConfig } from '../../rest/limitsAPI';
import { getSettingsByType } from '../../rest/settingConfigAPI';
import applicationRoutesClass from '../../utils/ApplicationRoutesClassBase';
import { LimitBanner } from '../common/LimitBanner/LimitBanner';
import LeftSidebar from '../MyData/LeftSidebar/LeftSidebar.component';
import NavBar from '../NavBar/NavBar';
import applicationsClassBase from '../Settings/Applications/AppDetails/ApplicationsClassBase';
import './app-container.less';

const { Content } = Layout;

const AppContainer = () => {
  const { currentUser, setAppPreferences, appPreferences } =
    useApplicationStore();
  const AuthenticatedRouter = applicationRoutesClass.getRouteElements();
  const ApplicationExtras = applicationsClassBase.getApplicationExtension();
  const { isAuthenticated } = useApplicationStore();

  const { setConfig, bannerDetails } = useLimitStore();

  const fetchAppConfigurations = useCallback(async () => {
    try {
      const [response, lineageConfig] = await Promise.all([
        getLimitConfig(),
        getSettingsByType(SettingType.LineageSettings),
      ]);

      setConfig(response);
      setAppPreferences({
        ...appPreferences,
        lineageConfig: lineageConfig as LineageSettings,
      });
    } catch (error) {
      // silent fail
    }
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchAppConfigurations();
    }
  }, [currentUser?.id]);

  return (
    <Layout>
      <LimitBanner />
      <Layout
        className={classNames('app-container', {
          ['extra-banner']: Boolean(bannerDetails),
        })}>
        {/* Render left side navigation */}
        <LeftSidebar />

        {/* Render main content */}
        <Layout>
          {/* Render Appbar */}
          {applicationRoutesClass.isProtectedRoute(location.pathname) &&
          isAuthenticated ? (
            <NavBar />
          ) : null}

          {/* Render main content */}
          <Content>
            <AuthenticatedRouter />
            {ApplicationExtras && <ApplicationExtras />}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AppContainer;
