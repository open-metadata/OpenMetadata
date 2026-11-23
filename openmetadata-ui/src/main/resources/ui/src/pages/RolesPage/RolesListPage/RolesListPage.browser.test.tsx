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
import { Role } from '../../../generated/entity/teams/role';
import { many, named } from '../../../test/browser/fixtures/entities';
import { describePaginatedList } from '../../../test/browser/paginationContract';

const roles: Role[] = many(40, (i) => ({ ...named('role', i), policies: [] }));

describePaginatedList({
  name: 'Settings › Roles',
  route: '/settings/access/roles',
  listPath: '/api/v1/roles',
  items: roles,
  itemLabel: (r) => r.displayName ?? r.name,
  knownIssues: {
    duplicateFetchOnPageChange:
      'RolesListPage.handlePaging fetches the page and then the URL effect fetches it again',
  },
});
