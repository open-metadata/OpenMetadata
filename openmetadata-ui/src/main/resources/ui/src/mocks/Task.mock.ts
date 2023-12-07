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
  Post,
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
  entityId: 'defcff8c-0823-40e6-9c1e-9b0458ba0fa5',
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
