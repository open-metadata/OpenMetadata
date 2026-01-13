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
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import AddGlossaryPageComponent from '../../../pages/AddGlossary/AddGlossaryPage.component';
import GlossaryPage from '../../../pages/Glossary/GlossaryPage/GlossaryPage.component';
import { userPermissions } from '../../../utils/PermissionsUtils';
import GlossaryVersion from '../../Glossary/GlossaryVersion/GlossaryVersion.component';
import AdminProtectedRoute from '../AdminProtectedRoute';

const GlossaryRouter = () => {
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();
  const glossaryPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  return (
    <Routes>
      <Route
        element={
          <AddGlossaryPageComponent
            pageTitle={t('label.add-entity', {
              entity: t('label.glossary'),
            })}
          />
        }
        path={ROUTES.ADD_GLOSSARY.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={<GlossaryVersion isGlossary />}
        path={ROUTES.GLOSSARY_VERSION.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={glossaryPermission}>
            <GlossaryPage pageTitle={t('label.glossary')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.GLOSSARY.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={glossaryPermission}>
            <GlossaryPage pageTitle={t('label.glossary')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={glossaryPermission}>
            <GlossaryPage pageTitle={t('label.glossary')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS_WITH_ACTION.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={glossaryPermission}>
            <GlossaryPage pageTitle={t('label.glossary')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS_WITH_TAB.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <AdminProtectedRoute hasPermission={glossaryPermission}>
            <GlossaryPage pageTitle={t('label.glossary')} />
          </AdminProtectedRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS_WITH_SUBTAB.replace(ROUTES.GLOSSARY, '')}
      />
    </Routes>
  );
};

export default GlossaryRouter;
