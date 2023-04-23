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

import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import {
  NO_PERMISSION_TO_VIEW,
  REACH_OUT_TO_ADMIN_FOR_ACCESS,
} from 'constants/HelperTextUtil';
import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { useAuth } from '../../hooks/authHooks';

interface AdminProtectedRouteProps extends RouteProps {
  hasPermission: boolean;
}

const AdminProtectedRoute = (routeProps: AdminProtectedRouteProps) => {
  const { isAdminUser } = useAuth();

  if (isAdminUser || routeProps.hasPermission) {
    return <Route {...routeProps} />;
  } else if (!routeProps.hasPermission) {
    return (
      <ErrorPlaceHolder>
        <p className="text-center">
          {NO_PERMISSION_TO_VIEW} <br /> {REACH_OUT_TO_ADMIN_FOR_ACCESS}
        </p>
      </ErrorPlaceHolder>
    );
  } else {
    return <Redirect to={ROUTES.SIGNIN} />;
  }
};

export default AdminProtectedRoute;
