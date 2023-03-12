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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EntityData } from '../TasksPage.interface';
import EntityDetail from './EntityDetail';

const mockData = {
  id: '45d6725f-fb62-492d-b7fb-3a37976d0252',
  name: 'raw_order',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
  description:
    'This is a raw orders table as represented in our online DB. This table contains all the orders by the customers and can be used to buid our dim and fact tables',
  version: 0.1,
  updatedAt: 1658309450843,
  updatedBy: 'anonymous',
  href: 'http://localhost:8585/api/v1/tables/45d6725f-fb62-492d-b7fb-3a37976d0252',
  tableType: 'Regular',
  columns: [
    {
      name: 'comments',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order.comments',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 1,
    },
    {
      name: 'creditcard',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.creditcard',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 2,
    },
    {
      name: 'membership',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.membership',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 4,
    },
    {
      name: 'orders',
      dataType: 'ARRAY',
      arrayDataType: 'STRUCT',
      dataLength: 1,
      dataTypeDisplay:
        'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64)>>',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order.orders',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 5,
    },
    {
      name: 'platform',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order.platform',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 6,
    },
    {
      name: 'preference',
      dataType: 'MAP',
      dataLength: 1,
      dataTypeDisplay: 'map<character varying(32),boolean>',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.preference',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 7,
    },
    {
      name: 'shipping_address',
      dataType: 'ARRAY',
      arrayDataType: 'STRUCT',
      dataLength: 1,
      dataTypeDisplay:
        'array<struct<name:character varying(32),street_address:character varying(128),city:character varying(32),postcode:character varying(8)>>',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.shipping_address',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 8,
    },
    {
      name: 'shipping_date',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.shipping_date',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 9,
    },
    {
      name: 'transaction_date',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.transaction_date',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 10,
    },
    {
      name: 'total_order_count',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        'The total number of orders that the customer has made from this store across their lifetime.',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.total_order_count',
      tags: [],
      ordinalPosition: 11,
    },
    {
      name: 'total_order_value',
      dataType: 'NUMERIC',
      dataTypeDisplay: 'numeric',
      description:
        "The total amount of money that the customer has spent on orders from the store across their lifetime. The value is formatted in the store's currency.",
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.total_order_value',
      tags: [],
      ordinalPosition: 12,
    },
    {
      name: 'first_order_date',
      dataType: 'TIMESTAMP',
      dataTypeDisplay: 'timestamp',
      description:
        'The date (ISO 8601) and time (UTC) when the customer placed their first order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.first_order_date',
      tags: [],
      ordinalPosition: 13,
    },
    {
      name: 'last_order_date',
      dataType: 'TIMESTAMP',
      dataTypeDisplay: 'timestamp',
      description:
        'The date (ISO 8601) and time (UTC) when the customer placed their most recent order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_order.last_order_date',
      tags: [],
      ordinalPosition: 14,
    },
  ],
  databaseSchema: {
    id: '6b563f01-a555-4410-a876-d692dad76f59',
    type: 'databaseSchema',
    name: 'shopify',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
    description:
      'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databaseSchemas/6b563f01-a555-4410-a876-d692dad76f59',
  },
  database: {
    id: 'c48da72e-1efb-4e4d-b323-6b9f3442f9bb',
    type: 'database',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/databases/c48da72e-1efb-4e4d-b323-6b9f3442f9bb',
  },
  service: {
    id: 'c35bf76e-b986-4a33-b5be-0f0059de6df0',
    type: 'databaseService',
    name: 'sample_data',
    fullyQualifiedName: 'sample_data',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/c35bf76e-b986-4a33-b5be-0f0059de6df0',
  },
  serviceType: 'BigQuery',
  tags: [],

  followers: [],

  deleted: false,
} as unknown as EntityData;

describe('Test Entity Details component', () => {
  it('Should render the component', async () => {
    render(<EntityDetail entityData={mockData} />);

    const container = await screen.findByTestId('entityDetail');

    const tierData = await screen.findByTestId('tier');

    const tagsData = await screen.findByTestId('tags');

    expect(container).toBeInTheDocument();
    expect(tierData).toBeInTheDocument();
    expect(tagsData).toBeInTheDocument();
  });
});
