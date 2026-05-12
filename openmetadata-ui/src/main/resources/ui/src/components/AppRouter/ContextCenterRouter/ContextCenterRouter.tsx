/*
 *  Copyright 2026 Collate.
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
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import withSuspenseFallback from '../withSuspenseFallback';

const ContextCenterDashboardPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterDashboardPage/ContextCenterDashboardPage'
      )
  )
);

const ContextCenterArticlesPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterArticlesPage/ContextCenterArticlesPage'
      )
  )
);

const ContextCenterDocumentsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterDocumentsPage/ContextCenterDocumentsPage'
      )
  )
);
{
  /* TODO: In progress */
}

// const ContextCenterIntegrationsPage = withSuspenseFallback(
//   React.lazy(
//     () =>
//       import(
//         '../../../pages/ContextCenterPage/ContextCenterIntegrationsPage/ContextCenterIntegrationsPage'
//       )
//   )
// );

// const ContextCenterArchivePage = withSuspenseFallback(
//   React.lazy(
//     () =>
//       import(
//         '../../../pages/ContextCenterPage/ContextCenterArchivePage/ContextCenterArchivePage'
//       )
//   )
// );

const ContextCenterRouter = () => {
  return (
    <Routes>
      <Route
        element={<Navigate replace to={ROUTES.CONTEXT_CENTER_DASHBOARD} />}
        path="/"
      />
      <Route
        element={<ContextCenterDashboardPage />}
        path={ROUTES.CONTEXT_CENTER_DASHBOARD.replace(
          ROUTES.CONTEXT_CENTER,
          ''
        )}
      />
      {[
        ROUTES.CONTEXT_CENTER_ARTICLES,
        ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL,
        ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_TAB,
        ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_SUB_TAB,
        ROUTES.CONTEXT_CENTER_ARTICLE_VERSION,
      ].map((route) => (
        <Route
          element={<ContextCenterArticlesPage />}
          key={route}
          path={route.replace(ROUTES.CONTEXT_CENTER, '')}
        />
      ))}
      <Route
        element={<ContextCenterDocumentsPage />}
        path={ROUTES.CONTEXT_CENTER_DOCUMENTS.replace(
          ROUTES.CONTEXT_CENTER,
          ''
        )}
      />
      {/* TODO: In progress */}
      {/* <Route
        element={<ContextCenterIntegrationsPage />}
        path={ROUTES.CONTEXT_CENTER_INTEGRATIONS.replace(
          ROUTES.CONTEXT_CENTER,
          ''
        )}
      />
      <Route
        element={<ContextCenterArchivePage />}
        path={ROUTES.CONTEXT_CENTER_ARCHIVE.replace(ROUTES.CONTEXT_CENTER, '')}
      /> */}
    </Routes>
  );
};

export default ContextCenterRouter;
