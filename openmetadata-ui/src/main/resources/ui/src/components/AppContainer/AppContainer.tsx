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
import { Content, Header } from 'antd/lib/layout/layout';
import Sider from 'antd/lib/layout/Sider';
import { isEmpty } from 'lodash';
import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import AppState from '../../AppState';
import Appbar from '../../components/AppBar/Appbar';
import LeftSidebar from '../../components/MyData/LeftSidebar/LeftSidebar.component';
import AuthenticatedAppRouter from '../../components/router/AuthenticatedAppRouter';
import { ROUTES } from '../../constants/constants';
import SignUpPage from '../../pages/SignUp/SignUpPage';
import './app-container.less';

const AppContainer = () => {
  return (
    <Switch>
      <Route exact component={SignUpPage} path={ROUTES.SIGNUP}>
        {!isEmpty(AppState.userDetails) && <Redirect to={ROUTES.HOME} />}
      </Route>

      <Layout className="app-container">
        <Header className="p-x-0">
          <Appbar />
        </Header>
        <Layout hasSider>
          <Sider className="left-sidebar-col" width={60}>
            <LeftSidebar />
          </Sider>
          <Content className="main-content">
            <AuthenticatedAppRouter />
          </Content>
        </Layout>
      </Layout>
    </Switch>
  );
};

export default AppContainer;
