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
import { Route, Switch } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
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
    <Switch>
      <Route exact component={AddGlossaryPage} path={ROUTES.ADD_GLOSSARY} />
      <Route
        exact
        component={() => <GlossaryVersion isGlossary />}
        path={ROUTES.GLOSSARY_VERSION}
      />
      <Route
        exact
        component={GlossaryVersion}
        path={[
          ROUTES.GLOSSARY_TERMS_VERSION_TAB,
          ROUTES.GLOSSARY_TERMS_VERSION,
        ]}
      />

      <AdminProtectedRoute
        exact
        component={GlossaryPage}
        hasPermission={glossaryPermission}
        path={[
          ROUTES.GLOSSARY,
          ROUTES.GLOSSARY_DETAILS,
          ROUTES.GLOSSARY_DETAILS_WITH_ACTION,
        ]}
      />

      <AdminProtectedRoute
        exact
        component={GlossaryPage}
        hasPermission={glossaryPermission}
        path={[
          ROUTES.GLOSSARY_DETAILS_WITH_TAB,
          ROUTES.GLOSSARY_DETAILS_WITH_SUBTAB,
        ]}
      />
    </Switch>
  );
};

export default GlossaryRouter;
