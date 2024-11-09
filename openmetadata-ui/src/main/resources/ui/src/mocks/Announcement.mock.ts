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
import { ThreadType } from '../generated/api/feed/createThread';

export const MOCK_ANNOUNCEMENT_DATA = {
  data: [
    {
      id: '36ea94c9-7f12-489c-94df-56cbefe14b2f',
      type: ThreadType.Announcement,
      href: 'http://localhost:8585/api/v1/feed/36ea94c9-7f12-489c-94df-56cbefe14b2f',
      threadTs: 1714026576902,
      about:
        '<#E::database::cy-database-service-373851.cypress-database-1714026557974>',
      entityId: '123f24e3-2a00-432e-b42b-b709f7ae74c0',
      createdBy: 'admin',
      updatedAt: 1714037939788,
      updatedBy: 'shreya',
      resolved: false,
      message: 'Cypress announcement',
      postsCount: 4,
      posts: [
        {
          id: 'ccf1ad4a-4cf0-4be9-bcc7-1459f533bab0',
          message: 'this is done!',
          postTs: 1714036398114,
          from: 'admin',
          reactions: [],
        },
        {
          id: '738eb0ae-0b71-4a13-8dd2-d7d7d73073b6',
          message: 'having a look on it!',
          postTs: 1714037894068,
          from: 'david',
          reactions: [],
        },
        {
          id: 'fdc984e7-2d69-4f06-8b94-531ff8b696f7',
          message: 'this if fixed and RCA given!',
          postTs: 1714037939785,
          from: 'shreya',
          reactions: [],
        },
        {
          id: '62434a57-57ec-4b5f-83c1-9ae5870337b6',
          message: 'test',
          postTs: 1714027952172,
          from: 'admin',
          reactions: [],
        },
      ],
      reactions: [],
      announcement: {
        description: 'Cypress announcement description',
        startTime: 1713983400,
        endTime: 1714415400,
      },
    },
  ],
  paging: {
    total: 1,
  },
};

export const MOCK_ANNOUNCEMENT_FEED_DATA = {
  id: '36ea94c9-7f12-489c-94df-56cbefe14b2f',
  type: 'Announcement',
  href: 'http://localhost:8585/api/v1/feed/36ea94c9-7f12-489c-94df-56cbefe14b2f',
  threadTs: 1714026576902,
  about:
    '<#E::database::cy-database-service-373851.cypress-database-1714026557974>',
  entityId: '123f24e3-2a00-432e-b42b-b709f7ae74c0',
  createdBy: 'admin',
  updatedAt: 1714047427117,
  updatedBy: 'admin',
  resolved: false,
  message: 'Cypress announcement',
  postsCount: 4,
  posts: [
    {
      id: '62434a57-57ec-4b5f-83c1-9ae5870337b6',
      message: 'test',
      postTs: 1714027952172,
      from: 'admin',
      reactions: [],
    },
    {
      id: 'ccf1ad4a-4cf0-4be9-bcc7-1459f533bab0',
      message: 'this is done!',
      postTs: 1714036398114,
      from: 'admin',
      reactions: [],
    },
    {
      id: '738eb0ae-0b71-4a13-8dd2-d7d7d73073b6',
      message: 'having a look on it!',
      postTs: 1714037894068,
      from: 'david',
      reactions: [],
    },
    {
      id: 'fdc984e7-2d69-4f06-8b94-531ff8b696f7',
      message: 'this if fixed and RCA given!',
      postTs: 1714037939785,
      from: 'shreya',
      reactions: [],
    },
  ],
  reactions: [],
  announcement: {
    description: 'Cypress announcement description.',
    startTime: 1713983400,
    endTime: 1714415400,
  },
};
