/*
 *  Copyright 2023 Collate.
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
import {
  Column,
  Constraint,
  DataType,
} from '../generated/entity/data/container';
import {
  FeedbackType,
  Post,
  RecognizerFeedback,
  TaskType,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../generated/entity/feed/thread';

/* eslint-disable max-len */
export const TASK_FEED: Thread = {
  id: '8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  type: ThreadType.Task,
  href: 'http://localhost:8585/api/v1/feed/8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  threadTs: 1701686127533,
  about:
    '<#E::table::sample_data.ecommerce_db.shopify."dim.shop"::columns::shop_id::tags>',
  createdBy: 'admin',
  updatedAt: 1701686127534,
  updatedBy: 'admin',
  resolved: false,
  message: 'Request tags for table dim.shop columns/shop_id',
  postsCount: 0,
  posts: [],
  reactions: [],
  task: {
    id: 2,
    type: TaskType.RequestTag,
    assignees: [
      {
        id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
        type: 'team',
        name: 'Sales',
        fullyQualifiedName: 'Sales',
        deleted: false,
      },
    ],
    status: ThreadTaskStatus.Open,
    oldValue: '[]',
    suggestion:
      '[{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","name":"SpecialCategory","description":"GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination."}]',
  },
};

export const TASK_POST: Post = {
  message: 'Request tags for table dim.shop columns/shop_id',
  postTs: 1701686127533,
  from: 'admin',
  id: '8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  reactions: [],
};

export const TASK_COLUMNS: Column[] = [
  {
    name: 'shop_id',
    dataType: DataType.Number,
    dataTypeDisplay: 'numeric',
    description:
      'Unique identifier for the store. This column is the primary key for this table.',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop".shop_id',
    tags: [],
    constraint: Constraint.PrimaryKey,
    ordinalPosition: 1,
  },
  {
    name: 'name',
    dataType: DataType.Varchar,
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: 'Name of your store.',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop".name',
    tags: [],
    ordinalPosition: 2,
  },
  {
    name: 'domain',
    dataType: DataType.Varchar,
    dataLength: 1000,
    dataTypeDisplay: 'varchar',
    description:
      'Primary domain specified for your online store. Your primary domain is the one that your customers and search engines see. For example, www.mycompany.com.',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop".domain',
    tags: [],
    ordinalPosition: 3,
  },
];

export const MOCK_ASSIGNEE_DATA = {
  data: {
    hits: {
      hits: [
        {
          text: 'Ashish Gupta',
          _index: 'user_search_index',
          _type: '_doc',
          _id: '18ca6cd1-d696-4a22-813f-c7a42fc09dc4',
          _score: 30,
          _ignored: ['description.keyword'],
          _source: {
            id: '18ca6cd1-d696-4a22-813f-c7a42fc09dc4',
            name: 'ashish',
            fullyQualifiedName: 'ashish',
            description:
              'this is test description. this is test description!this is test description!this is test description!this is test description!this is test description!this is test description!this is test description!this is test description!this is test description!this is test description!',
            displayName: 'Ashish Gupta',
            version: 0.8,
            updatedAt: 1699428544440,
            updatedBy: 'ashish',
            email: 'ashish@getcollate.io',
            isBot: false,
            isAdmin: true,
            profile: {
              images: {
                image:
                  'https://lh3.googleusercontent.com/a/ACg8ocJghhvg6uUMNVzzmA1YEtgSvHKmDmo0RSIeydHuqzM1=s96-c',
                image24:
                  'https://lh3.googleusercontent.com/a/ACg8ocJghhvg6uUMNVzzmA1YEtgSvHKmDmo0RSIeydHuqzM1=s24-c',
                image32:
                  'https://lh3.googleusercontent.com/a/ACg8ocJghhvg6uUMNVzzmA1YEtgSvHKmDmo0RSIeydHuqzM1=s32-c',
                image48:
                  'https://lh3.googleusercontent.com/a/ACg8ocJghhvg6uUMNVzzmA1YEtgSvHKmDmo0RSIeydHuqzM1=s48-c',
                image72:
                  'https://lh3.googleusercontent.com/a/ACg8ocJghhvg6uUMNVzzmA1YEtgSvHKmDmo0RSIeydHuqzM1=s72-c',
                image192:
                  'https://lh3.googleusercontent.com/a/ACg8ocJghhvg6uUMNVzzmA1YEtgSvHKmDmo0RSIeydHuqzM1=s192-c',
                image512:
                  'https://lh3.googleusercontent.com/a/ACg8ocJghhvg6uUMNVzzmA1YEtgSvHKmDmo0RSIeydHuqzM1=s512-c',
              },
            },
            teams: [
              {
                id: '9efbccd7-3d0b-485d-89c4-ac0f8fc80da5',
                type: 'team',
                name: 'Organization',
                fullyQualifiedName: 'Organization',
                description:
                  'Organization under which all the other team hierarchy is created',
                displayName: 'Organization',
                deleted: false,
                href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/9efbccd7-3d0b-485d-89c4-ac0f8fc80da5',
              },
            ],
            personas: [],
            deleted: false,
            roles: [],
            inheritedRoles: [
              {
                id: 'f8239edf-4f55-43a4-8d6e-a34e4fadee25',
                type: 'role',
                name: 'DataConsumer',
                fullyQualifiedName: 'DataConsumer',
                description:
                  'Users with Data Consumer role use different data assets for their day to day work.',
                displayName: 'Data Consumer',
                deleted: false,
              },
            ],
            isEmailVerified: true,
            domain: {
              id: '9545569e-9b4e-4be0-8142-ce5d502fbab7',
              type: 'domain',
              name: 'Product',
              fullyQualifiedName: 'Product',
              description:
                'A Domain producing  and serving Product Master Data.',
              displayName: 'Product Name',
              inherited: true,
            },
            fqnParts: ['ashish', 'Ashish Gupta'],
            suggest: [
              {
                input: 'ashish',
                weight: 5,
              },
              {
                input: 'Ashish Gupta',
                weight: 10,
              },
            ],
            entityType: 'user',
          },
          contexts: {
            deleted: ['false'],
          },
        },
        {
          text: 'Ashley King',
          _index: 'user_search_index',
          _type: '_doc',
          _id: '0c83a592-7ced-4156-b235-01726259a0e7',
          _score: 30,
          _source: {
            id: '0c83a592-7ced-4156-b235-01726259a0e7',
            name: 'ashley_king5',
            fullyQualifiedName: 'ashley_king5',
            displayName: 'Ashley King',
            version: 0.2,
            updatedAt: 1702647808915,
            updatedBy: 'ingestion-bot',
            email: 'ashley_king5@gmail.com',
            isAdmin: false,
            teams: [
              {
                id: 'dfa05a46-eb4f-4c68-8cd6-140b0d330b8d',
                type: 'team',
                name: 'Compute',
                fullyQualifiedName: 'Compute',
                deleted: false,
              },
            ],
            personas: [],
            deleted: false,
            roles: [],
            inheritedRoles: [
              {
                id: 'f8239edf-4f55-43a4-8d6e-a34e4fadee25',
                type: 'role',
                name: 'DataConsumer',
                fullyQualifiedName: 'DataConsumer',
                description:
                  'Users with Data Consumer role use different data assets for their day to day work.',
                displayName: 'Data Consumer',
                deleted: false,
              },
            ],
            domain: {
              id: '52fc9c67-78b7-42bf-8147-69278853c230',
              type: 'domain',
              name: 'Design',
              fullyQualifiedName: 'Design',
              description: "Here' the description for Product Design",
              displayName: 'Product Design ',
              inherited: true,
            },
            fqnParts: ['ashley_king5', 'Ashley King'],
            suggest: [
              {
                input: 'ashley_king5',
                weight: 5,
              },
              {
                input: 'Ashley King',
                weight: 10,
              },
            ],
            entityType: 'user',
            isBot: false,
          },
          contexts: {
            deleted: ['false'],
          },
        },
      ],
    },
  },
};

export const MOCK_TASK_ASSIGNEE = [
  {
    label: 'sample_data',
    name: 'sample_data',
    type: 'User',
    value: 'id1',
  },
];

export const MOCK_TASK = {
  id: 1,
  type: TaskType.RequestTag,
  assignees: [
    {
      id: 'd6764107-e8b4-4748-b256-c86fecc66064',
      type: 'User',
      name: 'xyz',
      fullyQualifiedName: 'xyz',
      deleted: false,
    },
  ],
  status: ThreadTaskStatus.Open,
  oldValue: '[]',
  suggestion:
    '[{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","name":"SpecialCategory","description":"GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination."}]',
};

export const MOCK_TASK_2 = {
  id: 1,
  type: TaskType.RequestTag,
  assignees: [
    {
      id: 'd6764107-e8b4-4748-b256-c86fecc66064',
      type: 'User',
      name: 'xyz',
      fullyQualifiedName: 'xyz',
      deleted: false,
    },
  ],
  status: ThreadTaskStatus.Open,
  oldValue: '[]',
};

export const MOCK_TASK_3 = {
  id: 1,
  type: TaskType.RequestApproval,
  assignees: [
    {
      id: 'd6764107-e8b4-4748-b256-c86fecc66064',
      type: 'User',
      name: 'xyz',
      fullyQualifiedName: 'xyz',
      deleted: false,
    },
  ],
  status: ThreadTaskStatus.Open,
  oldValue: '[]',
};

export const MOCK_RECOGNIZER_FEEDBACK: RecognizerFeedback = {
  entityLink:
    '<#E::table::sample_data.ecommerce_db.shopify."dim.shop"::columns::email>',
  feedbackType: FeedbackType.FalsePositive,
  tagFQN: 'PII.Sensitive',
  userComments: 'This is not a sensitive field',
  createdBy: {
    id: 'd6764107-e8b4-4748-b256-c86fecc66064',
    type: 'user',
    name: 'admin',
    displayName: 'Admin User',
    deleted: false,
  },
  createdAt: 1701686127533,
};

export const MOCK_TASK_RECOGNIZER_FEEDBACK = {
  id: 4,
  type: TaskType.RecognizerFeedbackApproval,
  assignees: [
    {
      id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
      type: 'team',
      name: 'DataGovernance',
      fullyQualifiedName: 'DataGovernance',
      deleted: false,
    },
  ],
  status: ThreadTaskStatus.Open,
  feedback: MOCK_RECOGNIZER_FEEDBACK,
};

export const TASK_FEED_RECOGNIZER_FEEDBACK: Thread = {
  id: 'feedback-8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  type: ThreadType.Task,
  href: 'http://localhost:8585/api/v1/feed/feedback-8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  threadTs: 1701686127533,
  about:
    '<#E::table::sample_data.ecommerce_db.shopify."dim.shop"::columns::email>',
  createdBy: 'admin',
  updatedAt: 1701686127534,
  updatedBy: 'admin',
  resolved: false,
  message: 'Review feedback for tag PII.Sensitive',
  postsCount: 0,
  posts: [],
  reactions: [],
  task: MOCK_TASK_RECOGNIZER_FEEDBACK,
};
