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
import { http, HttpResponse } from 'msw';
import { many, named } from '../../test/browser/fixtures/entities';
import {
  DASHBOARD_SERVICE,
  serveEntities,
} from '../../test/browser/fixtures/hierarchy';
import { worker } from '../../test/browser/msw';
import { describePaginatedList } from '../../test/browser/paginationContract';

const dashboards = many(40, (i) =>
  named('dashboard', i, DASHBOARD_SERVICE.fullyQualifiedName)
);

describePaginatedList({
  name: 'Dashboard service › Version 0.1 › Dashboards',
  route: `/service/dashboardServices/${DASHBOARD_SERVICE.name}/versions/0.1`,
  listPath: '/api/v1/dashboards',
  isPageRequest: (url) => url.searchParams.get('limit') !== '0',
  items: dashboards,
  itemLabel: (d) => d.displayName,
  // The version view lists children 10 at a time with no size selector.
  fixedPageSize: 10,
  setup: () => {
    serveEntities([['/api/v1/services/dashboardServices', DASHBOARD_SERVICE]]);
    worker.use(
      http.get('/api/v1/services/dashboardServices/:id/versions', () =>
        HttpResponse.json({
          entityType: 'dashboardService',
          versions: [JSON.stringify(DASHBOARD_SERVICE)],
        })
      ),
      http.get('/api/v1/services/dashboardServices/:id/versions/:version', () =>
        HttpResponse.json(DASHBOARD_SERVICE)
      )
    );
  },
  knownIssues: {
    duplicateFetchOnPageChange:
      'ServiceVersionPage.pagingHandler fetches, then the URL effect fetches again',
  },
});
