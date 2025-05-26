/*
 *  Copyright 2024 Collate.
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
import { useMemo } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import i18n from '../../utils/i18next/LocalUtil';
import { userPermissions } from '../../utils/PermissionsUtils';
import AddDomain from '../Domain/AddDomain/AddDomain.component';
import DomainPage from '../Domain/DomainPage.component';
import AdminProtectedRoute from './AdminProtectedRoute';

const DomainRouter = () => {
  const { permissions } = usePermissionProvider();
  const domainPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(ResourceEntity.DOMAIN, permissions),
    [permissions]
  );

  return (
    <Routes>
      <Route
        element={<AddDomain />}
        path={ROUTES.ADD_DOMAIN.replace(ROUTES.DOMAIN, '')}
      />
      <Route
        index
        element={
          <AdminProtectedRoute hasPermission={domainPermission}>
            <DomainPage pageTitle={i18n.t('label.domain')} />
          </AdminProtectedRoute>
        }
        path="/"
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={domainPermission}>
            <DomainPage pageTitle={i18n.t('label.domain')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.DOMAIN_DETAILS.replace(ROUTES.DOMAIN, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={domainPermission}>
            <DomainPage pageTitle={i18n.t('label.domain')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.DOMAIN_DETAILS_WITH_TAB.replace(ROUTES.DOMAIN, '')}
      />
    </Routes>
  );
};

export default DomainRouter;
