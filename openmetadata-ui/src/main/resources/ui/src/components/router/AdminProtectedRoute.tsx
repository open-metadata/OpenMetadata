/*
 *  Copyright 2022 Collate.
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
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import { ROUTES } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { useAuth } from '../../hooks/authHooks';

interface AdminProtectedRouteProps extends RouteProps {
  hasPermission?: boolean;
}

const AdminProtectedRoute = (routeProps: AdminProtectedRouteProps) => {
  const { isAdminUser } = useAuth();
  const hasPermission = Boolean(routeProps.hasPermission);

  if (isAdminUser || hasPermission) {
    return <Route {...routeProps} />;
  } else if (!hasPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  } else {
    return <Redirect to={ROUTES.SIGNIN} />;
  }
};

export default AdminProtectedRoute;
