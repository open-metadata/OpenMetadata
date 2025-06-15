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
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  ROUTES,
} from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import EntityVersionPage from '../../pages/EntityVersionPage/EntityVersionPage.component';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { useRequiredParams } from '../../utils/useRequiredParams';
import EntityImportRouter from './EntityImportRouter';

const EntityRouter = () => {
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();

  const Component = useMemo(
    () => entityUtilClassBase.getEntityDetailComponent(entityType),
    [entityType]
  );

  return (
    <Routes>
      {/* Handle Entity Import and Edit pages */}
      <Route
        element={<EntityImportRouter />}
        path={ROUTES.ENTITY_IMPORT.replace('/bulk', '')}
      />
      <Route
        element={<EntityImportRouter />}
        path={ROUTES.BULK_EDIT_ENTITY_WITH_FQN.replace('/bulk', '')}
      />

      <Route
        element={<EntityVersionPage />}
        path={ROUTES.ENTITY_VERSION_DETAILS_WITH_TAB.replace(
          PLACEHOLDER_ROUTE_ENTITY_TYPE,
          ''
        )}
      />
      <Route
        element={<EntityVersionPage />}
        path={ROUTES.ENTITY_VERSION_DETAILS.replace(
          PLACEHOLDER_ROUTE_ENTITY_TYPE,
          ''
        )}
      />

      {Component ? (
        <>
          <Route
            element={<Component />}
            path={ROUTES.ENTITY_DETAILS.replace(
              PLACEHOLDER_ROUTE_ENTITY_TYPE,
              ''
            )}
          />
          <Route
            element={<Component />}
            path={ROUTES.ENTITY_DETAILS_WITH_TAB.replace(
              PLACEHOLDER_ROUTE_ENTITY_TYPE,
              ''
            )}
          />
          <Route
            element={<Component />}
            path={ROUTES.ENTITY_DETAILS_WITH_SUB_TAB.replace(
              PLACEHOLDER_ROUTE_ENTITY_TYPE,
              ''
            )}
          />
        </>
      ) : (
        // If no route match, then redirect to not found page
        <Route element={<Navigate replace to={ROUTES.NOT_FOUND} />} path="*" />
      )}
    </Routes>
  );
};

export default EntityRouter;
