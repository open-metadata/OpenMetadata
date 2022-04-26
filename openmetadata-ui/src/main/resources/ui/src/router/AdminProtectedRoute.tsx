/*
 *  Copyright 2021 Collate
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

import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import { ROUTES } from '../constants/constants';
import { useAuth } from '../hooks/authHooks';

const AdminProtectedRoute = (routeProps: RouteProps) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled, isAuthenticated } = useAuthContext();

  if (isAuthDisabled || isAdminUser) {
    return <Route {...routeProps} />;
  } else if (isAuthenticated) {
    return <Redirect to={ROUTES.NOT_FOUND} />;
  } else {
    return <Redirect to={ROUTES.SIGNIN} />;
  }
};

export default AdminProtectedRoute;
