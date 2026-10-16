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
import { User } from '../../generated/entity/teams/user';
import { many, named } from '../../test/browser/fixtures/entities';
import { worker } from '../../test/browser/msw';
import { describePaginatedList } from '../../test/browser/paginationContract';

const users: User[] = many(40, (i) => ({
  ...named('user', i),
  email: `pw_user_${i}@example.com`,
  isAdmin: false,
  isBot: false,
}));

describePaginatedList({
  name: 'Settings › Users',
  route: '/settings/members/users',
  listPath: '/api/v1/users',
  items: users,
  itemLabel: (u) => u.displayName ?? u.name,
  search: { index: 'user', urlParam: 'user', term: 'pw' },
  deletedToggleTestId: 'show-deleted',
  // Each row's avatar resolves its user by name (one request per row).
  setup: () =>
    worker.use(
      http.get('/api/v1/users/name/:fqn', ({ params }) =>
        HttpResponse.json(users.find((u) => u.fullyQualifiedName === params.fqn))
      )
    ),
});
