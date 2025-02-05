/*
 *  Copyright 2025 Collate.
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

export const MOCK_CERTIFICATION_FEED: Thread = {
  type: ThreadType.Conversation,
  id: '0c7d3b72-1d91-47ef-9b8b-d4f7dcabbc63',
  href: 'http://localhost:8585/api/v1/feed/0c7d3b72-1d91-47ef-9b8b-d4f7dcabbc63',
  threadTs: 1738666818753,
  about: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  entityRef: {
    id: '068c0985-4922-4523-b460-6b501bc0993d',
    type: 'table',
    name: 'dim_address',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
    // eslint-disable-next-line max-len
    description: `This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.`,
    displayName: 'dim_address',
    deleted: false,
  },
  entityUrlLink:
    '[sample_data.ecommerce_db.shopify.dim_address](/table/sample_data.ecommerce_db.shopify.dim_address)',
  domain: 'f84cf63d-6a4e-4e77-85cb-927202b4286b',
  generatedBy: GeneratedBy.System,
  cardStyle: CardStyle.Certification,
  fieldOperation: FieldOperation.Updated,
  feedInfo: {
    headerMessage:
      'admin updated certification  for asset [sample_data.ecommerce_db.shopify.dim_address](/table/sample_data.ecommerce_db.shopify.dim_address)',
    fieldName: '',
    entitySpecificInfo: {
      updatedValue:
        // eslint-disable-next-line max-len
        '{"tagLabel":{"tagFQN":"Certification.Gold","name":"Gold","description":"Gold certified Data Asset.","style":{"color":"#FFCE00","iconURL":"GoldCertification.svg"},"source":"Classification","labelType":"Manual","state":"Confirmed"},"appliedDate":1738666815691,"expiryDate":1741258815691}',
      previousValue:
        // eslint-disable-next-line max-len
        '{"tagLabel":{"tagFQN":"Certification.Gold","name":"Gold","description":"Gold certified Data Asset.","style":{"color":"#FFCE00","iconURL":"GoldCertification.svg"},"source":"Classification","labelType":"Manual","state":"Confirmed"},"appliedDate":1738666713588,"expiryDate":1741258713588}',
    },
  },
  createdBy: 'admin',
  updatedAt: 1738666818753,
  updatedBy: 'admin',
  resolved: false,
  message:
    ' Updated certification  for asset [sample_data.ecommerce_db.shopify.dim_address](/table/sample_data.ecommerce_db.shopify.dim_address)',
  postsCount: 0,
  posts: [],
  reactions: [],
};
