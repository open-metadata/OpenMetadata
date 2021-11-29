/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

const mockData = [
  {
    instance: {
      name: 'brenda_thomas4',
      displayName: 'Brenda Thomas',
      id: '0948fb57-ccc3-4bf5-93e0-c79550080473',
      href: 'http://localhost:3000/api/v1/users/0948fb57-ccc3-4bf5-93e0-c79550080473',
    },
    displayName: 'Brenda Thomas',
    timezone: 'PST',
    isBot: false,
    team: [
      {
        name: 'Infra',
        id: '288e534d-7a70-41aa-8207-659dd75b9b3d',
        documentation: 'Team Name',
        href: 'http://localhost:3000/api/v1/teams/288e534d-7a70-41aa-8207-659dd75b9b3d',
      },
      {
        name: 'Marketplace',
        id: '90e28507-8c50-410d-85a7-e18856f5e2b3',
        documentation: 'Team Name',
        href: 'http://localhost:3000/api/v1/teams/90e28507-8c50-410d-85a7-e18856f5e2b3',
      },
    ],
    role: [
      {
        name: 'ROLE_ADMIN',
        id: '433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
        documentation: '',
        href: 'http://localhost:3000/api/v1/roles/433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
      },
      {
        name: 'ROLE_DATA_SCIENTIST',
        id: 'a39b0ea3-f9c1-4aa6-9853-fcd4c985bf4d',
        documentation: '',
        href: 'http://localhost:3000/api/v1/roles/a39b0ea3-f9c1-4aa6-9853-fcd4c985bf4d',
      },
    ],
  },
  {
    instance: {
      name: 'daniel_grimes1',
      displayName: 'Daniel Grimes',
      id: '096a8cb5-37ea-41e7-934c-b1bd4c1c0f5d',
      href: 'http://localhost:3000/api/v1/users/096a8cb5-37ea-41e7-934c-b1bd4c1c0f5d',
    },
    displayName: 'Daniel Grimes',
    timezone: 'PST',
    isBot: false,
    team: [
      {
        name: 'Trust',
        id: '4eab6621-e2cd-44f8-88ff-162ec5b2674a',
        documentation: 'Team Name',
        href: 'http://localhost:3000/api/v1/teams/4eab6621-e2cd-44f8-88ff-162ec5b2674a',
      },
    ],
    role: [
      {
        name: 'ROLE_ADMIN',
        id: '433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
        documentation: '',
        href: 'http://localhost:3000/api/v1/roles/433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
      },
    ],
  },
  {
    instance: {
      name: 'emily_thornton5',
      displayName: 'Emily Thornton',
      id: '0bd810e5-96f2-4aac-a495-988e6d1a1918',
      href: 'http://localhost:3000/api/v1/users/0bd810e5-96f2-4aac-a495-988e6d1a1918',
    },
    displayName: 'Emily Thornton',
    timezone: 'PST',
    isBot: false,
    team: [
      {
        name: 'Data Infra',
        id: 'ab2b31c6-e2d7-4b6e-8171-99bd8fff89f9',
        documentation: 'Team Name',
        href: 'http://localhost:3000/api/v1/teams/ab2b31c6-e2d7-4b6e-8171-99bd8fff89f9',
      },
    ],
    role: [
      {
        name: 'ROLE_ADMIN',
        id: '433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
        documentation: '',
        href: 'http://localhost:3000/api/v1/roles/433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
      },
    ],
  },
];

export default mockData;

export const user = {
  name: 'Brenda Thomas',
  timezone: 'PST',
  isBot: false,
  id: '0948fb57-ccc3-4bf5-93e0-c79550080473',
  team: [
    {
      name: 'Infra',
      id: '288e534d-7a70-41aa-8207-659dd75b9b3d',
      documentation: 'Team Name',
      href: 'http://localhost:3000/api/v1/teams/288e534d-7a70-41aa-8207-659dd75b9b3d',
    },
    {
      name: 'Marketplace',
      id: '90e28507-8c50-410d-85a7-e18856f5e2b3',
      documentation: 'Team Name',
      href: 'http://localhost:3000/api/v1/teams/90e28507-8c50-410d-85a7-e18856f5e2b3',
    },
  ],
  role: [
    {
      name: 'ROLE_ADMIN',
      id: '433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
      documentation: '',
      href: 'http://localhost:3000/api/v1/roles/433ff9f1-0f1a-4c9d-b0ad-93504990baf8',
    },
    {
      name: 'ROLE_DATA_SCIENTIST',
      id: 'a39b0ea3-f9c1-4aa6-9853-fcd4c985bf4d',
      documentation: '',
      href: 'http://localhost:3000/api/v1/roles/a39b0ea3-f9c1-4aa6-9853-fcd4c985bf4d',
    },
  ],
};
