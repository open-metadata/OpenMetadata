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
import {
  CardStyle,
  FieldOperation,
  GeneratedBy,
  Thread,
  ThreadType,
} from '../generated/entity/feed/thread';

export const MOCK_DESCRIPTION_FEED_1: Thread = {
  id: '1e20be19-d44f-420d-87ee-c963f1074ac3',
  type: ThreadType.Conversation,
  href: 'http://localhost:8585/api/v1/feed/1e20be19-d44f-420d-87ee-c963f1074ac3',
  threadTs: 1722237351340,
  about: '<#E::om::table::om::Glue.default.information_schema.sales>',
  entityRef: {
    id: '88c344aa-fa64-4345-9393-c35beeaa893a',
    type: 'table',
    name: 'sales',
    fullyQualifiedName: 'Glue.default.information_schema.sales',
    description:
      '# Data Asset Header\n\n~~Data Asset HeaderData Asset HeaderData Asset HeaderData Asset',
    displayName: 'sales',
    deleted: false,
  },
  entityUrlLink:
    '[Glue.default.information_schema.sales](/table/Glue.default.information_schema.sales)',
  generatedBy: GeneratedBy.System,
  cardStyle: CardStyle.Description,
  fieldOperation: FieldOperation.Updated,
  feedInfo: {
    headerMessage: `admin updated the description for table [Glue.default.information_schema.sales]`,
    fieldName: 'description',
    entitySpecificInfo: {
      diffMessage:
        'Updated **description**: <span class="diff-removed">Sales data</span>',
      newDescription:
        '# Data Asset Header\n\n~~Data Asset HeaderData Asset HeaderData Asset HeaderData',
      previousDescription: 'Sales data',
    },
  },
  createdBy: 'admin',
  updatedAt: 1722237351340,
  updatedBy: 'admin',
  resolved: false,
  message:
    'Updated **description**: <span class="diff-removed">Sales data</span>',
  postsCount: 0,
  posts: [],
  reactions: [],
};

export const MOCK_DESCRIPTION_FEED_2: Thread = {
  id: 'fb553937-ef9c-46bb-af1f-4d336fcb05cd',
  type: ThreadType.Conversation,
  href: 'http://localhost:8585/api/v1/feed/fb553937-ef9c-46bb-af1f-4d336fcb05cd',
  threadTs: 1722236662421,
  about:
    '<#E::om::table::om::sample_data.ecommerce_db.shopify.cypress_version_table-400129>',
  entityRef: {
    id: 'f17db291-8bdb-4234-abee-fd7ccfd35304',
    type: 'table',
    name: 'cypress_version_table-400129',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.cypress_version_table-400129',
    description: 'Description for cypress_version_table-400129',
    displayName: 'cypress_version_table-400129',
    deleted: false,
  },
  entityUrlLink: `[sample_data.ecommerce_db.shopify.cypress_version_table-400129](/table/sample_data.ecommerce_db.shopify.cypress_version_table-400129)`,
  generatedBy: GeneratedBy.System,
  cardStyle: CardStyle.Description,
  fieldOperation: FieldOperation.Added,
  feedInfo: {
    headerMessage: `admin added the description for table [sample_data.ecommerce_db.shopify.cypress_version_table-400129](/table/sample_data.ecommerce_db.shopify.cypress_version_table-400129)`,
    fieldName: 'description',
    entitySpecificInfo: {
      diffMessage: `Added **description**: <span class="diff-added">Description for cypress_version_table-400129</span>`,
      newDescription: 'Description for cypress_version_table-400129',
      previousDescription: '',
    },
  },
  createdBy: 'admin',
  updatedAt: 1722236662421,
  updatedBy: 'admin',
  resolved: false,
  message: `Added **description**: <span class="diff-added">Description for cypress_version_table-400129</span>`,
  postsCount: 0,
  posts: [],
  reactions: [],
};

export const MOCK_DESCRIPTION_FEED_3: Thread = {
  id: '77501bc8-302c-4c82-a466-086337ec9ad9',
  type: ThreadType.Conversation,
  href: 'http://localhost:8585/api/v1/feed/77501bc8-302c-4c82-a466-086337ec9ad9',
  threadTs: 1722236662421,
  about:
    '<#E::om::table::om::sample_data.ecommerce_db.shopify.cypress_version_table-400129>',
  entityRef: {
    id: 'f17db291-8bdb-4234-abee-fd7ccfd35304',
    type: 'table',
    name: 'cypress_version_table-400129',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.cypress_version_table-400129',
    description: 'Description for cypress_version_table-400129',
    displayName: 'cypress_version_table-400129',
    deleted: false,
  },
  entityUrlLink: `[sample_data.ecommerce_db.shopify.cypress_version_table-400129](/table/sample_data.ecommerce_db.shopify.cypress_version_table-400129)`,
  generatedBy: GeneratedBy.System,
  cardStyle: CardStyle.Description,
  fieldOperation: FieldOperation.Added,
  feedInfo: {
    headerMessage: `admin added the description for table [sample_data.ecommerce_db.shopify.cypress_version_table-400129](/table/sample_data.ecommerce_db.shopify.cypress_version_table-400129)`,
    fieldName: 'description',
    entitySpecificInfo: {
      diffMessage: `Added **last_name.description**: <span class="diff-added">Last name of the staff member.</span>`,
      newDescription: 'Last name of the staff member.',
      previousDescription: '',
    },
  },
  createdBy: 'admin',
  updatedAt: 1722236662421,
  updatedBy: 'admin',
  resolved: false,
  message: `Added **last_name.description**: <span class="diff-added">Last name of the staff member.</span>`,
  postsCount: 0,
  posts: [],
  reactions: [],
};

export const MOCK_DESCRIPTION_FEED_4: Thread = {
  id: '2387533a-d594-4d89-9df5-89eba087a331',
  type: ThreadType.Conversation,
  href: 'http://localhost:8585/api/v1/feed/2387533a-d594-4d89-9df5-89eba087a331',
  threadTs: 1722236662006,
  about:
    '<#E::om::table::om::sample_data.ecommerce_db.shopify.cypress_version_table-400129>',
  entityRef: {
    id: 'f17db291-8bdb-4234-abee-fd7ccfd35304',
    type: 'table',
    name: 'cypress_version_table-400129',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.cypress_version_table-400129',
    description: 'Description for cypress_version_table-400129',
    displayName: 'cypress_version_table-400129',
    deleted: false,
  },
  entityUrlLink: `[sample_data.ecommerce_db.shopify.cypress_version_table-400129](/table/sample_data.ecommerce_db.shopify.cypress_version_table-400129)`,
  generatedBy: GeneratedBy.System,
  cardStyle: CardStyle.Description,
  fieldOperation: FieldOperation.Deleted,
  feedInfo: {
    headerMessage: `admin deleted the description for table [sample_data.ecommerce_db.shopify.cypress_version_table-400129](/table/sample_data.ecommerce_db.shopify.cypress_version_table-400129)`,
    fieldName: 'description',
    entitySpecificInfo: {
      diffMessage: `Deleted **first_name.description**: <span class="diff-removed">First name of the staff member.</span>`,
      newDescription: '',
      previousDescription: 'First name of the staff member.',
    },
  },
  createdBy: 'admin',
  updatedAt: 1722236662006,
  updatedBy: 'admin',
  resolved: false,
  message: `Deleted **first_name.description**: <span class="diff-removed">First name of the staff member.</span>`,
  postsCount: 0,
  posts: [],
  reactions: [],
};
