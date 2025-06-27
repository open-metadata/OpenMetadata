/*
 *  Copyright 2022 Collate.
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

export const MOCK_USER_DATA = {
  data: [
    {
      id: '4efd3518-16ae-483c-8c99-d622bcbfbfab',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      version: 0.4,
      updatedAt: 1659077698874,
      updatedBy: 'anonymous',
      email: 'aaron_johnson0@gmail.com',
      href: 'http://localhost:8585/api/v1/users/4efd3518-16ae-483c-8c99-d622bcbfbfab',
      isAdmin: false,
      teams: [
        {
          id: '71b6a498-6a48-4529-af1c-3bb28d3cd67e',
          type: 'team',
          name: 'Cloud_Infra',
          fullyQualifiedName: 'Cloud_Infra',
          description: 'This is Cloud_Infra description.',
          displayName: 'Cloud_Infra',
          deleted: false,
          href: 'http://localhost:8585/api/v1/teams/71b6a498-6a48-4529-af1c-3bb28d3cd67e',
        },
      ],
      deleted: false,
      roles: [],
      inheritedRoles: [
        {
          id: '8ca4fb74-ee36-453c-91ec-7bd5fc361e00',
          type: 'role',
          name: 'DataConsumer',
          fullyQualifiedName: 'DataConsumer',
          displayName: 'Data Consumer',
          deleted: false,
          href: 'http://localhost:8585/api/v1/roles/8ca4fb74-ee36-453c-91ec-7bd5fc361e00',
        },
      ],
    },
  ],
  paging: {
    total: 1,
  },
};

export const MOCK_EMPTY_USER_DATA = {
  data: [],
  paging: {
    total: 0,
  },
};
