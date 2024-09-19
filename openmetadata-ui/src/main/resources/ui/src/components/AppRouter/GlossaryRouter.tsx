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

import { ROUTES_RELATIVE } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import AddGlossaryPage from '../../pages/AddGlossary/AddGlossaryPage.component';
import GlossaryPage from '../../pages/Glossary/GlossaryPage/GlossaryPage.component';
import { userPermissions } from '../../utils/PermissionsUtils';
import GlossaryVersion from '../Glossary/GlossaryVersion/GlossaryVersion.component';
import AdminProtectedRoute from './AdminProtectedRoute';

const GlossaryRouter = () => {
  const { permissions } = usePermissionProvider();
  const glossaryPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  return (
    <Routes>
      <Route
        element={<AdminProtectedRoute hasPermission={glossaryPermission} />}>
        <Route
          element={<GlossaryPage />}
          path={ROUTES_RELATIVE.GLOSSARY_DETAILS_WITH_SUBTAB}
        />
        <Route
          element={<GlossaryPage />}
          path={ROUTES_RELATIVE.GLOSSARY_DETAILS_WITH_TAB}
        />
        <Route
          element={<GlossaryPage />}
          path={ROUTES_RELATIVE.GLOSSARY_DETAILS_WITH_ACTION}
        />
        <Route
          element={<GlossaryPage />}
          path={ROUTES_RELATIVE.GLOSSARY_DETAILS}
        />
        <Route element={<GlossaryPage />} path="/" />
      </Route>
      <Route
        element={<AddGlossaryPage />}
        path={ROUTES_RELATIVE.ADD_GLOSSARY}
      />
      <Route
        element={<GlossaryVersion isGlossary />}
        path={ROUTES_RELATIVE.GLOSSARY_VERSION}
      />
      <Route
        element={<GlossaryVersion />}
        path={ROUTES_RELATIVE.GLOSSARY_TERMS_VERSION_TAB}
      />
      <Route
        element={<GlossaryVersion />}
        path={ROUTES_RELATIVE.GLOSSARY_TERMS_VERSION}
      />
    </Routes>
  );
};

export default GlossaryRouter;
