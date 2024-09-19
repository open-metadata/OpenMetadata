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
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ROUTES, ROUTES_RELATIVE } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import EntityVersionPage from '../../pages/EntityVersionPage/EntityVersionPage.component';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';

const EntityRouter = () => {
  const { entityType } = useParams<{ entityType: EntityType }>();

  const Component = useMemo(
    () => entityUtilClassBase.getEntityDetailComponent(entityType as string),
    [entityType]
  );

  return (
    <Routes>
      <Route
        element={<EntityVersionPage />}
        path={ROUTES_RELATIVE.ENTITY_VERSION_DETAILS}
      />
      <Route
        element={<EntityVersionPage />}
        path={ROUTES_RELATIVE.ENTITY_VERSION_DETAILS_WITH_TAB}
      />

      {Component ? (
        <>
          <Route
            element={<Component />}
            path={ROUTES_RELATIVE.ENTITY_DETAILS}
          />
          <Route
            element={<Component />}
            path={ROUTES_RELATIVE.ENTITY_DETAILS_WITH_TAB}
          />
          <Route
            element={<Component />}
            path={ROUTES_RELATIVE.ENTITY_DETAILS_WITH_SUB_TAB}
          />
        </>
      ) : (
        // If not route match is found then redirect to not found page
        <Route element={<Navigate replace to={ROUTES.NOT_FOUND} />} path="*" />
      )}
    </Routes>
  );
};

export default EntityRouter;
