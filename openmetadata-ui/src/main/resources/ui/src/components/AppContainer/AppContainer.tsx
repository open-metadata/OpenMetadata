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
import { isEmpty } from 'lodash';
import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import SignUpPage from '../../pages/SignUp/SignUpPage';
import Appbar from '../AppBar/Appbar';
import AuthenticatedAppRouter from '../AppRouter/AuthenticatedAppRouter';
import { useAuthContext } from '../Auth/AuthProviders/AuthProvider';
import LeftSidebar from '../MyData/LeftSidebar/LeftSidebar.component';
import './app-container.less';

const AppContainer = () => {
  const { Header, Sider, Content } = Layout;
  const { currentUser } = useAuthContext();

  return (
    <Switch>
      <Route exact component={SignUpPage} path={ROUTES.SIGNUP}>
        {!isEmpty(currentUser) && <Redirect to={ROUTES.HOME} />}
      </Route>

      <Layout className="app-container">
        <Sider className="left-sidebar-col" width={60}>
          <LeftSidebar />
        </Sider>
        <Layout>
          <Header className="p-x-0">
            <Appbar />
          </Header>
          <Content className="main-content">
            <AuthenticatedAppRouter />
          </Content>
        </Layout>
      </Layout>
    </Switch>
  );
};

export default AppContainer;
