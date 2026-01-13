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
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import ClassificationVersionPage from '../../pages/ClassificationVersionPage/ClassificationVersionPage';
import TagsPage from '../../pages/TagsPage/TagsPage';
import { userPermissions } from '../../utils/PermissionsUtils';
import AdminProtectedRoute from './AdminProtectedRoute';

const ClassificationRouter = () => {
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();
  const tagCategoryPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(
        ResourceEntity.CLASSIFICATION,
        permissions
      ),

    [permissions]
  );

  return (
    <Routes>
      <Route
        element={
          <AdminProtectedRoute hasPermission={tagCategoryPermission}>
            <TagsPage pageTitle={t('label.tag-plural')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.TAGS.replace(ROUTES.TAGS, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={tagCategoryPermission}>
            <TagsPage pageTitle={t('label.tag-plural')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.TAG_DETAILS.replace(ROUTES.TAGS, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={tagCategoryPermission}>
            <ClassificationVersionPage />
          </AdminProtectedRoute>
        }
        path={ROUTES.TAG_VERSION.replace(ROUTES.TAGS, '')}
      />
    </Routes>
  );
};

export default ClassificationRouter;
