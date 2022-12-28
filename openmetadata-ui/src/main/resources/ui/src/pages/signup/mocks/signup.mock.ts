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

export const mockCreateUser = {
  data: {
    id: '911d4be4-6ebf-48a0-9016-43a2cf716428',
    name: 'test.user',
    fullyQualifiedName: 'test.user',
    displayName: 'Test User',
    version: 0.1,
    updatedAt: 1665145804919,
    updatedBy: 'test.user',
    email: 'test.user@test.com',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/users/911d4be4-6ebf-48a0-9016-43a2cf716428',
    isAdmin: false,
    profile: {
      images: {
        image: '',
      },
    },
    teams: [
      {
        id: '606c1d33-213b-4626-a619-0e4cef9f5069',
        type: 'team',
        name: 'Engineering',
        fullyQualifiedName: 'Engineering',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/606c1d33-213b-4626-a619-0e4cef9f5069',
      },
    ],
    deleted: false,
    inheritedRoles: [
      {
        id: '4509b668-2882-45c3-90e1-4551043f8cbd',
        type: 'role',
        name: 'DataConsumer',
        fullyQualifiedName: 'DataConsumer',
        description:
          'Users with Data Consumer role use different data assets for their day to day work.',
        displayName: 'Data Consumer',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/roles/4509b668-2882-45c3-90e1-4551043f8cbd',
      },
    ],
  },
};
