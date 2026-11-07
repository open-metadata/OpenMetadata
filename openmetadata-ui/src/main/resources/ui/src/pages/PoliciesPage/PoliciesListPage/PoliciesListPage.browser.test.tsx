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
import { Policy } from '../../../generated/entity/policies/policy';
import { many, named } from '../../../test/browser/fixtures/entities';
import { describePaginatedList } from '../../../test/browser/paginationContract';

const policies: Policy[] = many(40, (i) => ({
  ...named('policy', i),
  rules: [],
}));

describePaginatedList({
  name: 'Settings › Policies',
  route: '/settings/access/policies',
  listPath: '/api/v1/policies',
  items: policies,
  itemLabel: (p) => p.displayName ?? p.name,
  knownIssues: {
    duplicateFetchOnPageChange:
      'PoliciesListPage.handlePaging fetches the page and then the URL effect fetches it again',
  },
});
