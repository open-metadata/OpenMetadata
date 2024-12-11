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

import { TokenType } from '../../../../generated/auth/personalAccessToken';

export const mockUserData = {
  id: 'd6764107-e8b4-4748-b256-c86fecc66064',
  name: 'xyz',
  displayName: 'XYZ',
  version: 0.1,
  updatedAt: 1648704499857,
  updatedBy: 'xyz',
  email: 'xyz@gmail.com',
  href: 'http://localhost:8585/api/v1/users/d6764107-e8b4-4748-b256-c86fecc66064',
  isAdmin: false,
  profile: {
    images: {
      image512:
        'https://lh3.googleusercontent.com/a-/AOh14Gh8NPux8jEPIuyPWOxAB1od9fGN188Kcp5HeXgc=s512-c',
    },
  },
  teams: [
    {
      id: '3362fe18-05ad-4457-9632-84f22887dda6',
      type: 'team',
      name: 'Finance',
      description: 'This is Finance description.',
      displayName: 'Finance',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/3362fe18-05ad-4457-9632-84f22887dda6',
    },
    {
      id: '5069ddd4-d47e-4b2c-a4c4-4c849b97b7f9',
      type: 'team',
      name: 'Data_Platform',
      description: 'This is Data_Platform description.',
      displayName: 'Data_Platform',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/5069ddd4-d47e-4b2c-a4c4-4c849b97b7f9',
    },
    {
      id: '7182cc43-aebc-419d-9452-ddbe2fc4e640',
      type: 'team',
      name: 'Customer_Support',
      description: 'This is Customer_Support description.',
      displayName: 'Customer_Support',
      deleted: true,
      href: 'http://localhost:8585/api/v1/teams/7182cc43-aebc-419d-9452-ddbe2fc4e640',
    },
  ],
  owns: [],
  follows: [],
  deleted: false,
  roles: [
    {
      id: 'ce4df2a5-aaf5-4580-8556-254f42574aa7',
      type: 'role',
      name: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/ce4df2a5-aaf5-4580-8556-254f42574aa7',
    },
  ],
  inheritedRoles: [
    {
      id: '3fa30148-72f6-4205-8cab-56696cc23440',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/3fa30148-72f6-4205-8cab-56696cc23440',
    },
  ],
};

export const mockUsersTabData = {
  id: 'f281e7fd-5fd3-4279-8a2d-ade80febd743',
  name: 'aaron_johnson0',
  fullyQualifiedName: 'aaron_johnson0',
  displayName: 'Aaron Johnson',
  version: 1.5,
  updatedAt: 1707198736848,
  updatedBy: 'admin',
  email: 'aaron_johnson0@gmail.com',
  href: 'http://localhost:8585/api/v1/users/f281e7fd-5fd3-4279-8a2d-ade80febd743',
  isAdmin: false,
  teams: [
    {
      id: '35c03c5c-5160-41af-b08d-ef2b2b9e6adf',
      type: 'team',
      name: 'Sales',
      fullyQualifiedName: 'Sales',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/35c03c5c-5160-41af-b08d-ef2b2b9e6adf',
    },
  ],
  changeDescription: {
    fieldsAdded: [
      {
        name: 'teams',
        newValue:
          '[{"id":"35c03c5c-5160-41af-b08d-ef2b2b9e6adf","type":"team","name":"Sales","fullyQualifiedName":"Sales","deleted":false}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [
      {
        name: 'teams',
        oldValue: '[{"id":"f39f326a-81a1-42ca-976]',
      },
    ],
    previousVersion: 1.4,
  },
  deleted: false,
  roles: [
    {
      id: 'e4b20aef-c6c4-4416-aaae-f60185c7cac0',
      type: 'role',
      name: 'DataSteward',
      fullyQualifiedName: 'DataSteward',
      description: 'Users with Data Steward',
      displayName: 'Data Steward',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/e4b20aef-c6c4-4416-aaae-f60185c7cac0',
    },
  ],
  inheritedRoles: [
    {
      id: '5f1445a7-c299-4dde-8c5b-704c6cd68ee6',
      type: 'role',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      displayName: 'Data Consumer',
      deleted: false,
      href: 'http://localhost:8585/api/v1/roles/5f1445a7-c299-4dde-8c5b-704c6cd68ee6',
    },
  ],
};

export const mockUserRole = {
  data: [
    {
      id: '3ed7b995-ce8b-4720-9beb-6f4a9c626920',
      name: 'DataConsumer',
      fullyQualifiedName: 'DataConsumer',
      displayName: 'Data Consumer',
      description:
        'Users with Data Consumer role use different data assets for their day to day work.',
      version: 0.1,
      updatedAt: 1663825430544,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/roles/3ed7b995-ce8b-4720-9beb-6f4a9c626920',
      allowDelete: false,
      deleted: false,
    },
  ],
  paging: {
    total: 1,
  },
};

export const mockAccessData = {
  expiryDate: 1701714886101,
  jwtToken: 'eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5Mmot',
  token: '4946956adf3a8d646',
  tokenName: 'test',
  tokenType: TokenType.PersonalAccessToken,
  userId: '445291f4d62c1bae',
};
export const mockPersonaData = [
  {
    description: 'Person-04',
    displayName: 'Person-04',
    fullyQualifiedName: 'Person-04',
    href: 'http://localhost:8585/api/v1/personas/0430976d-092a-46c9-90a8-61c6091a6f38',
    id: '0430976d-092a-46c9-90a8-61c6091a6f38',
    name: 'Person-04',
    type: 'persona',
  },
];
