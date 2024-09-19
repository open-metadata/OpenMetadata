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
import React, { useMemo } from 'react';
import { Route, Routes } from 'react-router-dom';
import {
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_VERSION,
} from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import ClassificationVersionPage from '../../pages/ClassificationVersionPage/ClassificationVersionPage';
import TagsPage from '../../pages/TagsPage/TagsPage';
import { userPermissions } from '../../utils/PermissionsUtils';
import AdminProtectedRoute from './AdminProtectedRoute';

const ClassificationRouter = () => {
  const { permissions } = usePermissionProvider();
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
        element={<AdminProtectedRoute hasPermission={tagCategoryPermission} />}>
        <Route element={<TagsPage />} path="/" />
        <Route element={<TagsPage />} path={`/${PLACEHOLDER_ROUTE_FQN}`} />
        <Route
          element={<ClassificationVersionPage />}
          path={`/${PLACEHOLDER_ROUTE_FQN}/versions/${PLACEHOLDER_ROUTE_VERSION}`}
        />
      </Route>
    </Routes>
  );
};

export default ClassificationRouter;
