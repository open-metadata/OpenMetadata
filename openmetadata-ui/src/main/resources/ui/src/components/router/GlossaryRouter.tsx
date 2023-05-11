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
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ROUTES } from 'constants/constants';
import React, { useMemo } from 'react';
import { Route, Switch } from 'react-router-dom';
import { userPermissions } from 'utils/PermissionsUtils';
import AdminProtectedRoute from './AdminProtectedRoute';
import withSuspenseFallback from './withSuspenseFallback';

const GlossaryVersionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../components/GlossaryVersion/GlossaryVersion.component')
  )
);

const ImportGlossary = withSuspenseFallback(
  React.lazy(
    () => import('../../components/Glossary/ImportGlossary/ImportGlossary')
  )
);

const GlossaryV1 = withSuspenseFallback(
  React.lazy(() => import('../../components/Glossary/GlossaryV2.component'))
);

const GlossaryRouter = () => {
  const { permissions } = usePermissionProvider();
  const glossaryPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const glossaryTermPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(
        ResourceEntity.GLOSSARY_TERM,
        permissions
      ),

    [permissions]
  );

  return (
    <Switch>
      <Route
        exact
        component={() => <GlossaryVersionPage isGlossary />}
        path={ROUTES.GLOSSARY_VERSION}
      />
      <Route
        exact
        component={GlossaryVersionPage}
        path={ROUTES.GLOSSARY_TERMS_VERSION}
      />
      <Route
        exact
        component={GlossaryVersionPage}
        path={ROUTES.GLOSSARY_TERMS_VERSION_TAB}
      />
      <AdminProtectedRoute
        exact
        component={GlossaryV1}
        hasPermission={glossaryTermPermission}
        path={ROUTES.GLOSSARY_DETAILS}
      />
      <AdminProtectedRoute
        exact
        component={ImportGlossary}
        hasPermission={glossaryTermPermission}
        path={ROUTES.GLOSSARY_IMPORT}
      />
      <AdminProtectedRoute
        exact
        component={GlossaryV1}
        hasPermission={glossaryPermission}
        path={ROUTES.GLOSSARY_DETAILS_WITH_TAB}
      />
    </Switch>
  );
};

export default GlossaryRouter;
