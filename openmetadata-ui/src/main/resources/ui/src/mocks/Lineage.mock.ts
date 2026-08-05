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

import { MarkerType, Position } from 'reactflow';

const F80DE28C_ECCE_46FB_88C7_152CC111F9EC =
  'f80de28c-ecce-46fb-88c7-152cc111f9ec' as const;
const _5F2EEE5D_1C08_4756_AF31_DABCE7CB26FD =
  '5f2eee5d-1c08-4756-af31-dabce7cb26fd' as const;
const _92D7CB90_CC49_497A_9B01_18F4C6A61951 =
  '92d7cb90-cc49-497a-9b01-18f4c6a61951' as const;
const _2D30F754_05DE_4372_AF27_F221997BFE9A =
  '2d30f754-05de-4372-af27-f221997bfe9a' as const;
const A0F3199F_5FEA_4C41_AF43_BB66EF3C845E =
  'a0f3199f-5fea-4c41-af43-bb66ef3c845e' as const;
const SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_RAW =
  'sample_data.ecommerce_db.shopify.raw_product_catalog.comments' as const;
const F52ACB5F_2B2C_440C_91C1_90B46D138FAD =
  'f52acb5f-2b2c-440c-91c1-90b46d138fad' as const;
const SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_DIM =
  'sample_data.ecommerce_db.shopify.dim_location.location_id' as const;

/* eslint-disable max-len */
export const MOCK_LINEAGE_DATA = {
  entity: {
    id: F80DE28C_ECCE_46FB_88C7_152CC111F9EC,
    type: 'table',
    name: 'fact_session',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_session',
    description:
      'This fact table contains information about the visitors to your online store. This table has one row per session, where one session can contain many page views. If you use Urchin Traffic Module (UTM) parameters in marketing campaigns, then you can use this table to track how many customers they direct to your store.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/tables/f80de28c-ecce-46fb-88c7-152cc111f9ec',
  },
  nodes: [
    {
      id: _5F2EEE5D_1C08_4756_AF31_DABCE7CB26FD,
      type: 'table',
      name: 'dim_customer',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
      description:
        'The dimension table contains data about your customers. The customers table contains one row per customer. It includes historical metrics (such as the total amount that each customer has spent in your store) as well as forward-looking metrics (such as the predicted number of days between future orders and the expected order value in the next 30 days). This table also includes columns that segment customers into various categories (such as new, returning, promising, at risk, dormant, and loyal), which you can use to target marketing activities.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/tables/5f2eee5d-1c08-4756-af31-dabce7cb26fd',
    },
    {
      id: _92D7CB90_CC49_497A_9B01_18F4C6A61951,
      type: 'table',
      name: 'storage_service_entity',
      fullyQualifiedName:
        'mysql.default.openmetadata_db.storage_service_entity',
      deleted: false,
      href: 'http://localhost:8585/api/v1/tables/92d7cb90-cc49-497a-9b01-18f4c6a61951',
    },
    {
      id: _2D30F754_05DE_4372_AF27_F221997BFE9A,
      type: 'table',
      name: 'dim_address',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
      description:
        'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/tables/2d30f754-05de-4372-af27-f221997bfe9a',
    },
    {
      id: 'b5d520fd-a4a5-4173-85d5-f804ddab452a',
      type: 'table',
      name: 'dashboard_service_entity',
      fullyQualifiedName:
        'mysql.default.openmetadata_db.dashboard_service_entity',
      deleted: false,
      href: 'http://localhost:8585/api/v1/tables/b5d520fd-a4a5-4173-85d5-f804ddab452a',
    },
    {
      id: 'bf99a241-76e9-4947-86a7-c9bf3c326974',
      type: 'table',
      name: 'dim.product',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.product"',
      description:
        'This dimension table contains information about each of the products in your store. This table contains one row per product. This table reflects the current state of products in your Shopify admin.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/tables/bf99a241-76e9-4947-86a7-c9bf3c326974',
    },
    {
      id: 'd4aab894-5877-44f1-840c-b08a2dc664a4',
      type: 'pipeline',
      name: 'dim_address_etl',
      fullyQualifiedName: 'sample_airflow.dim_address_etl',
      description: 'dim_address ETL pipeline',
      displayName: 'dim_address etl',
      deleted: false,
      href: 'http://localhost:8585/api/v1/pipelines/d4aab894-5877-44f1-840c-b08a2dc664a4',
    },
    {
      id: '5a51ea54-8304-4fa8-a7b2-1f083ff1580c',
      type: 'pipeline',
      name: 'presto_etl',
      fullyQualifiedName: 'sample_airflow.presto_etl',
      description: 'Presto ETL pipeline',
      displayName: 'Presto ETL',
      deleted: false,
      href: 'http://localhost:8585/api/v1/pipelines/5a51ea54-8304-4fa8-a7b2-1f083ff1580c',
    },
  ],
  upstreamEdges: [
    {
      fromEntity: _2D30F754_05DE_4372_AF27_F221997BFE9A,
      toEntity: _5F2EEE5D_1C08_4756_AF31_DABCE7CB26FD,
      lineageDetails: {
        sqlQuery: '',
        columnsLineage: [
          {
            fromColumns: [
              'sample_data.ecommerce_db.shopify.dim_address.address_id',
            ],
            toColumn:
              'sample_data.ecommerce_db.shopify.dim_customer.total_order_value',
          },
        ],
      },
    },
    {
      fromEntity: _5F2EEE5D_1C08_4756_AF31_DABCE7CB26FD,
      toEntity: F80DE28C_ECCE_46FB_88C7_152CC111F9EC,
      lineageDetails: {
        sqlQuery: '',
        columnsLineage: [
          {
            fromColumns: [
              'sample_data.ecommerce_db.shopify.dim_customer.customer_id',
            ],
            toColumn:
              'sample_data.ecommerce_db.shopify.fact_session.derived_session_token',
          },
        ],
      },
    },
    {
      fromEntity: _92D7CB90_CC49_497A_9B01_18F4C6A61951,
      toEntity: F80DE28C_ECCE_46FB_88C7_152CC111F9EC,
    },
    {
      fromEntity: 'b5d520fd-a4a5-4173-85d5-f804ddab452a',
      toEntity: _2D30F754_05DE_4372_AF27_F221997BFE9A,
      lineageDetails: {
        sqlQuery: '',
        columnsLineage: [
          {
            fromColumns: [
              'mysql.default.openmetadata_db.dashboard_service_entity.id',
            ],
            toColumn: 'sample_data.ecommerce_db.shopify.dim_address.shop_id',
          },
        ],
      },
    },
    {
      fromEntity: 'bf99a241-76e9-4947-86a7-c9bf3c326974',
      toEntity: _2D30F754_05DE_4372_AF27_F221997BFE9A,
      lineageDetails: {
        sqlQuery: '',
        columnsLineage: [
          {
            fromColumns: [
              'sample_data.ecommerce_db.shopify."dim.product".shop_id',
            ],
            toColumn: 'sample_data.ecommerce_db.shopify.dim_address.first_name',
          },
        ],
      },
    },
    {
      fromEntity: 'd4aab894-5877-44f1-840c-b08a2dc664a4',
      toEntity: _2D30F754_05DE_4372_AF27_F221997BFE9A,
    },
    {
      fromEntity: '5a51ea54-8304-4fa8-a7b2-1f083ff1580c',
      toEntity: _92D7CB90_CC49_497A_9B01_18F4C6A61951,
    },
  ],
  downstreamEdges: [
    {
      toEntity: _92D7CB90_CC49_497A_9B01_18F4C6A61951,
      fromEntity: F80DE28C_ECCE_46FB_88C7_152CC111F9EC,
    },
  ],
};

export const MOCK_NODES_AND_EDGES = {
  nodes: [
    {
      id: A0F3199F_5FEA_4C41_AF43_BB66EF3C845E,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: 'default',
      className: 'leaf-node core',
      data: {
        label: 'ecommerce_db.shopify.raw_product_catalog',
        isEditMode: false,
        columns: {
          'sample_data.ecommerce_db.shopify.raw_product_catalog.comments': {
            name: 'comments',
            dataType: 'STRING',
            dataLength: 1,
            dataTypeDisplay: 'string',
            fullyQualifiedName: SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_RAW,
            constraint: 'NULL',
            ordinalPosition: 1,
            type: 'input',
          },
        },
        isExpanded: true,
        node: {
          id: A0F3199F_5FEA_4C41_AF43_BB66EF3C845E,
          type: 'table',
          name: 'raw_product_catalog',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_product_catalog',
          description: 'description ',
          deleted: false,
          href: 'href',
        },
      },
      position: {
        x: 0,
        y: 0,
      },
    },
    {
      id: F52ACB5F_2B2C_440C_91C1_90B46D138FAD,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: 'output',
      className: 'leaf-node',
      data: {
        label: 'ecommerce_db.shopify.dim_location',
        entityType: 'table',
        isEditMode: false,
        isExpanded: true,
        columns: {
          'sample_data.ecommerce_db.shopify.dim_location.location_id': {
            name: 'location_id',
            dataType: 'NUMERIC',
            dataTypeDisplay: 'numeric',
            fullyQualifiedName: SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_DIM,
            constraint: 'PRIMARY_KEY',
            ordinalPosition: 1,
            type: 'output',
          },
        },
        node: {
          id: F52ACB5F_2B2C_440C_91C1_90B46D138FAD,
          type: 'table',
          name: 'dim_location',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_location',
          description: 'description',
          deleted: false,
          href: 'href',
        },
      },
      position: {
        x: 650,
        y: 0,
      },
    },
  ],
  edges: [
    {
      id: 'column-sample_data.ecommerce_db.shopify.raw_product_catalog.comments-sample_data.ecommerce_db.shopify.dim_location.location_id-edge-a0f3199f-5fea-4c41-af43-bb66ef3c845e-f52acb5f-2b2c-440c-91c1-90b46d138fad',
      source: A0F3199F_5FEA_4C41_AF43_BB66EF3C845E,
      target: F52ACB5F_2B2C_440C_91C1_90B46D138FAD,
      targetHandle: SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_DIM,
      sourceHandle: SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_RAW,
      type: 'buttonedge',
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      data: {
        id: 'column-sample_data.ecommerce_db.shopify.raw_product_catalog.comments-sample_data.ecommerce_db.shopify.dim_location.location_id-edge-a0f3199f-5fea-4c41-af43-bb66ef3c845e-f52acb5f-2b2c-440c-91c1-90b46d138fad',
        source: A0F3199F_5FEA_4C41_AF43_BB66EF3C845E,
        target: F52ACB5F_2B2C_440C_91C1_90B46D138FAD,
        targetHandle: SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_DIM,
        sourceHandle: SAMPLE_DATA_ECOMMERCE_DB_SHOPIFY_RAW,
        isEditMode: false,
        isColumnLineage: true,
      },
    },
    {
      id: 'edge-a0f3199f-5fea-4c41-af43-bb66ef3c845e-f52acb5f-2b2c-440c-91c1-90b46d138fad',
      source: A0F3199F_5FEA_4C41_AF43_BB66EF3C845E,
      target: F52ACB5F_2B2C_440C_91C1_90B46D138FAD,
      type: 'buttonedge',
      animated: false,
      style: {
        strokeWidth: '2px',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      data: {
        id: 'edge-a0f3199f-5fea-4c41-af43-bb66ef3c845e-f52acb5f-2b2c-440c-91c1-90b46d138fad',
        label: '',
        source: A0F3199F_5FEA_4C41_AF43_BB66EF3C845E,
        target: F52ACB5F_2B2C_440C_91C1_90B46D138FAD,
        sourceType: 'table',
        targetType: 'table',
        isEditMode: false,
        isColumnLineage: false,
      },
    },
  ],
};
