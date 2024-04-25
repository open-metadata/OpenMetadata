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
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Redirect, Route, Switch } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useDomainStore } from '../../hooks/useDomainStore';
import PageNotFound from '../../pages/PageNotFound/PageNotFound';
import SignUpPage from '../../pages/SignUp/SignUpPage';
import applicationRoutesClass from '../../utils/ApplicationRoutesClassBase';
import Appbar from '../AppBar/Appbar';
import LeftSidebar from '../MyData/LeftSidebar/LeftSidebar.component';
import applicationsClassBase from '../Settings/Applications/AppDetails/ApplicationsClassBase';
import './app-container.less';

const AppContainer = () => {
  const { i18n } = useTranslation();
  const { Header, Sider, Content } = Layout;
  const { currentUser } = useApplicationStore();
  const { fetchDomainList } = useDomainStore();
  const AuthenticatedRouter = applicationRoutesClass.getRouteElements();
  const ApplicationExtras = applicationsClassBase.getApplicationExtension();
  const isDirectionRTL = useMemo(() => i18n.dir() === 'rtl', [i18n]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchDomainList();
    }
  }, [currentUser?.id]);

  return (
    <Switch>
      <Route exact component={SignUpPage} path={ROUTES.SIGNUP}>
        {!isEmpty(currentUser) && <Redirect to={ROUTES.HOME} />}
      </Route>
      {/* Do not move this route as we don't want to render the sidebar and header in 404 page */}
      <Route exact component={PageNotFound} path={ROUTES.NOT_FOUND} />

      <Layout className="app-container">
        <Sider
          className={classNames('left-sidebar-col', {
            'left-sidebar-col-rtl': isDirectionRTL,
          })}
          width={60}>
          <LeftSidebar />
        </Sider>
        <Layout>
          <Header className="p-x-0">
            <Appbar />
          </Header>
          <Layout>
            <Content className="main-content">
              <AuthenticatedRouter />
              {ApplicationExtras && <ApplicationExtras />}
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Switch>
  );
};

export default AppContainer;
