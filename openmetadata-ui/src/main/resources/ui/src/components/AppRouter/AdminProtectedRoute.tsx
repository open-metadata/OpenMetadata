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
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ROUTES } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { useAuth } from '../../hooks/authHooks';

type AdminProtectedRouteProps = {
  hasPermission?: boolean;
  children: React.ReactNode;
};

const AdminProtectedRoute = ({
  hasPermission,
  children,
}: AdminProtectedRouteProps): JSX.Element => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const location = useLocation();

  if (isAdminUser || hasPermission) {
    return <>{children}</>;
  } else if (!hasPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view')}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return <Navigate replace state={{ from: location }} to={ROUTES.SIGNIN} />;
};

export default AdminProtectedRoute;
