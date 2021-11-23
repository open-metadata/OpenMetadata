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

/* eslint-disable */

const mockData = {
  team: '--',
  superOrg: '--',
  usage: '--',
  lastWeekQueryCount: '--',
  likeCount: '--',
  platform: 'Redshift',
  qualityDetails: [
    { key: 'Freshness', value: '--' },
    { key: 'SLA', value: '--' },
    { key: 'Availability', value: '--' },
    { key: 'Integrity Tests', value: '--' },
  ],
  relatedTablesList: ['--', '--', '--', '--', '--', '--', '--', '--'],
};

export default mockData;

export const schemaDetails = {
  columns: [
    {
      columnId: 1,
      name: 'order_id',
      columnDataType: 'uuid',
      description:
        'The unique numeric identifier for the order. This ID is unique across Shopify stores. This column is the primary key for this table. ' +
        'In your Shopify admin, this ID is used internally. Most merchants are familiar with the other ID that appears on orders in the Shopify admin. This ID can be found in the Name column.',
      selected: true,
    },
    {
      columnId: 2,
      name: 'api_client_id',
      columnDataType: 'numeric',
      description:
        'The ID of the API client that called the Shopify API. This column is a foreign key reference to the api_client_id column in the API clients table.',
      selected: true,
    },
    {
      columnId: 3,
      name: 'billing_address_id',
      columnDataType: 'numeric',
      description:
        "The ID of the customer's billing address. This column is a foreign key reference to the address_id column in the addresses table. Contains null if the customer didn't or " +
        "couldn't specify a billing address. For example, orders made using the Shopify POS usually don't have a billing address associated with them.",
      selected: true,
      piiTags: ['PiiTypes.ADDRESS', 'PiiTypes.LOCATION'],
    },
    {
      columnId: 4,
      name: 'customer_id',
      columnDataType: 'uuid',
      description:
        'The ID of the customer. This column is a foreign key reference to the customer_id column in the customers table.',
      selected: true,
    },
    {
      columnId: 5,
      name: 'location_id',
      columnDataType: 'numeric',
      description:
        'The ID of the location of the Shopify POS system. This column is a foreign key reference to location_id column in the locations table. The location_id is null for orders ' +
        'not placed through Shopify POS, such as those placed through the online store.',
      selected: true,
      piiTags: ['PiiTypes.LOCATION'],
    },
    {
      columnId: 6,
      name: 'shipping_address_id',
      columnDataType: 'numeric',
      description:
        "The ID of the customer's shipping address. This column is a foreign key reference to the address_id column in the addresses table. Contains null if the customer couldn't or didn't " +
        "specify a shipping address. For example, orders made using the Shopify POS usually don't have a shipping address associated with them.",
      selected: true,
    },
    {
      columnId: 7,
      name: 'shop_id',
      columnDataType: 'uuid',
      description:
        'The ID of the store. This column is a foreign key reference to the shop_id column in the shops table.',
      selected: true,
    },
    {
      columnId: 8,
      name: 'user_id',
      columnDataType: 'uuid',
      description:
        'The ID of the staff member who created the order. This column is a foreign key reference to the ID in the users table. This column applies to Shopify ' +
        'POS orders and to orders that were converted from draft orders.',
      selected: true,
    },
    {
      columnId: 9,
      name: 'name',
      columnDataType: 'varchar',
      description:
        'The identifier of the order that the merchant and customer sees. This is the ID that appears on the order in the Shopify admin. For example, #1001. ' +
        'By default, this identifier is unique to one store. If you have multiple stores, then use the order_id column to guarantee uniqueness across multiple stores.',
      selected: true,
      piiTags: ['PiiTypes.USER_NAME'],
    },
    {
      columnId: 10,
      name: 'total_price',
      columnDataType: 'numeric',
      description:
        'The total price of the order, including shipping and taxes. This column includes gift card sales, but does not include returns. ' +
        'This value may not be accurate for API-imported orders. Do not use this column for financial calculations. Instead, use the total_price column in the sales table.',
      selected: true,
    },
    {
      columnId: 11,
      name: 'total_price_fx',
      columnDataType: 'numeric',
      description:
        'This column contains the same data as the total_prices column, but the values are converted to a fixed currency (USD).',
      selected: true,
    },
    {
      columnId: 12,
      name: 'discount_code',
      columnDataType: 'varchar',
      description: 'The discount code that was applied to the order.',
      selected: true,
    },
    {
      columnId: 13,
      name: 'fulfillment_status',
      columnDataType: 'varchar',
      description:
        'Contains the fulfillment status of the order. Valid values include:Fulfilled: Every line item in the order has been fulfilled.Partial: At least one line item in the order has been ' +
        'fulfilled.Unfulfilled: None of the line items in the order has been fulfilled. See the line items table for information about the fulfillment of individual line items.',
      selected: true,
    },
    {
      columnId: 14,
      name: 'cancel_reason',
      columnDataType: 'varchar',
      description:
        'Contains the reason why the order was canceled. If the order was not canceled, this value is null. If the order was canceled, the value will be one of the following: ' +
        'customer: Customer changed or canceled the order.fraud: Order was fraudulent.inventory: Items in the order were not in inventory.declined: Order was canceled because the payment ' +
        'has been declined.other: Order was canceled for a reason not in the list above.',
      selected: true,
    },
    {
      columnId: 15,
      name: 'processed_at',
      columnDataType: 'timestamp',
      description:
        'The date (ISO 8601) and time (UTC) when the order was created. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
      selected: true,
    },
    {
      columnId: 16,
      name: 'canceled_at',
      columnDataType: 'timestamp',
      description:
        'If the order was canceled, then this column contains the date (ISO 8601) and time (UTC) when the order was canceled. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
      selected: true,
    },
    {
      columnId: 17,
      name: 'deleted_at',
      columnDataType: 'timestamp',
      description:
        'If the order was deleted, then this column contains the date (ISO 8601) and time (UTC) when the order was deleted. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
      selected: true,
    },
    {
      columnId: 18,
      name: 'test',
      columnDataType: 'boolean',
      description: 'True when the order is a test order, False otherwise.',
      selected: true,
    },
  ],
  data: [
    {
      order_id: '0c2e21ed-da15-40b0-bad1-5d7250ea2995',
      api_client_id: '1001',
      billing_address_id: '1101',
      customer_id: '855045f9-200a-48f1-b902-015d8279af4b',
      location_id: '1001',
      shipping_address_id: 'null',
      shop_id: '87ea6bb8-c7ef-49d9-937e-550b862aef8e',
      user_id: '460e40e3-ac79-4957-bad7-8c098c1ead80',
      name: 'Justin Whiteley',
      total_price: '10.5',
      total_price_fx: '10.5',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'null',
      processed_at: '44013.7111226852',
      canceled_at: 'null',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'bc41f788-e273-4bb4-ba21-7a7f154e1e56',
      api_client_id: '1002',
      billing_address_id: '1101',
      customer_id: '428c8ddf-05fb-49ec-a961-b7362d29d69d',
      location_id: '1002',
      shipping_address_id: 'null',
      shop_id: '08cea148-b3f5-4582-a073-bf7dc0f59b97',
      user_id: 'ec10b78a-57ba-41c7-8544-822b08921765',
      name: 'Maja Charlton',
      total_price: '11.05',
      total_price_fx: '11.05',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'null',
      processed_at: '44013.7111226852',
      canceled_at: 'null',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '44fe1ab6-1d97-4e7d-b1ea-7a621a065bc7',
      api_client_id: '1001',
      billing_address_id: '1102',
      customer_id: '84c3f785-815a-4b4e-b3dc-14bd946d433d',
      location_id: '1003',
      shipping_address_id: '3001',
      shop_id: '9b42034b-1a2a-42fb-ad07-f25f06740234',
      user_id: 'cb569a6c-3aca-41cd-8a78-ce6eeddc1516',
      name: 'Carwyn Waters',
      total_price: '12',
      total_price_fx: '12',
      discount_code: 'null',
      fulfillment_status: 'Partial',
      cancel_reason: 'customer',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'b74642ed-e0c6-45f2-9620-b64c0cf88758',
      api_client_id: '1002',
      billing_address_id: '1101',
      customer_id: '6b86693c-762e-4cd4-9f18-177b0e6b79eb',
      location_id: '1004',
      shipping_address_id: '3002',
      shop_id: '32c5edb9-276f-4ed3-81ef-2058175f76c3',
      user_id: '460e40e3-ac79-4957-bad7-8c098c1ead80',
      name: 'Justin Whiteley',
      total_price: '15',
      total_price_fx: '15',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'fraud',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'ee55536f-8b5e-437c-94d5-2242f6378236',
      api_client_id: '1001',
      billing_address_id: '1102',
      customer_id: '61d21c05-ceaa-4359-9437-42636a96068f',
      location_id: '1001',
      shipping_address_id: 'null',
      shop_id: '864d24fb-6903-4ebf-b792-657984d784f7',
      user_id: '34a8ddca-721f-41f3-9ff6-856bc4a88df4',
      name: 'Teddie Roach',
      total_price: '75',
      total_price_fx: '75',
      discount_code: 'SALE50OFF',
      fulfillment_status: 'Partial',
      cancel_reason: 'inventory',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'e13dda48-9398-4479-a82e-9988e7b7e626',
      api_client_id: '1001',
      billing_address_id: '1101',
      customer_id: 'a474c38f-1ae2-4835-ac55-8a4e0fe0335d',
      location_id: '1003',
      shipping_address_id: '3002',
      shop_id: '779d5010-0b49-4bff-b787-fc1347a041cd',
      user_id: '460e40e3-ac79-4957-bad7-8c098c1ead80',
      name: 'Justin Whiteley',
      total_price: '15',
      total_price_fx: '15',
      discount_code: 'null',
      fulfillment_status: 'Unfulfilled',
      cancel_reason: 'customer',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '6b901716-ef6a-4f87-9b3e-da22f52b1932',
      api_client_id: '1001',
      billing_address_id: '1101',
      customer_id: 'a9e9df46-c469-4a56-bf6a-48f743f4391e',
      location_id: '1002',
      shipping_address_id: 'null',
      shop_id: '21275311-b1ea-4ddc-8253-d33f17cada15',
      user_id: 'd826351d-9ae1-4e98-8202-0a62d939a256',
      name: 'Helen Fox',
      total_price: '90.89',
      total_price_fx: '90.89',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'fraud',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '36e8176e-e459-412e-86a7-416f52a50518',
      api_client_id: '1001',
      billing_address_id: '1103',
      customer_id: 'faa15e50-4b4f-4925-a5e5-6e7ce735ee70',
      location_id: '1003',
      shipping_address_id: '3003',
      shop_id: 'a18f262a-513c-47d7-b510-b1fa64354cb5',
      user_id: 'a795f17d-7524-4fbe-969a-fa615ee164c9',
      name: 'Tommy Bryan',
      total_price: '101.5',
      total_price_fx: '101.5',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Unfulfilled',
      cancel_reason: 'declined',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'd6eb1b61-6cff-479d-8cac-4ad35205a419',
      api_client_id: '1002',
      billing_address_id: '1103',
      customer_id: 'a8cf8a6a-e10d-4e95-a0e6-f1457c17fbb5',
      location_id: '1004',
      shipping_address_id: '3004',
      shop_id: '2d110ea2-6eff-409d-91f4-cd9ae8c2099c',
      user_id: 'ff3a909a-9ac1-448e-b2be-95850677e6d5',
      name: 'Stevie Cartwright',
      total_price: '15',
      total_price_fx: '15',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Partial',
      cancel_reason: 'other',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '3c55a765-7672-4ef1-804f-24a805c3d978',
      api_client_id: '1002',
      billing_address_id: '1102',
      customer_id: '2dcfaa63-fb3b-4ae5-942e-ce78a4764e64',
      location_id: '1002',
      shipping_address_id: '3002',
      shop_id: '05b0308f-bc8f-4705-95ee-6dbffb8b0af0',
      user_id: '460e40e3-ac79-4957-bad7-8c098c1ead80',
      name: 'Justin Whiteley',
      total_price: '17.99',
      total_price_fx: '17.99',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'null',
      processed_at: '44013.7111226852',
      canceled_at: 'null',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '6e6cbee1-9767-4411-9ea4-fbac9beb1420',
      api_client_id: '1001',
      billing_address_id: '1103',
      customer_id: '8c3f1558-5bd8-4b06-83ab-35d9c9b6e5b5',
      location_id: '1001',
      shipping_address_id: '3003',
      shop_id: '1a6188cd-01b2-484d-855e-763b9623f238',
      user_id: 'a795f17d-7524-4fbe-969a-fa615ee164c9',
      name: 'Tommy Bryan',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'null',
      fulfillment_status: 'Unfulfilled',
      cancel_reason: 'declined',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'fdbbf278-b021-4f07-ad9b-3fac8aa06aeb',
      api_client_id: '1002',
      billing_address_id: '1102',
      customer_id: 'a60688d8-e5de-493c-82aa-e1eecab899ea',
      location_id: '1001',
      shipping_address_id: '3005',
      shop_id: 'b8c85560-41b7-4753-870f-963ec00ab722',
      user_id: 'd8b6a40a-3524-48ed-9bce-96b4eaebcd64',
      name: 'Seamus Shea',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'null',
      fulfillment_status: 'Partial',
      cancel_reason: 'other',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '6eb57449-6547-444c-8902-18fe58b5030a',
      api_client_id: '1001',
      billing_address_id: '1103',
      customer_id: 'c4698d01-c26a-4825-9874-02a15cf34341',
      location_id: '1002',
      shipping_address_id: '3006',
      shop_id: '6b46560d-a8fb-491d-afe4-cbea8d1c006e',
      user_id: '3964025b-ac72-44d9-9420-2244d86e480c',
      name: 'Randall Underwood',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'null',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'null',
      processed_at: '44013.7111226852',
      canceled_at: 'null',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '33e434f7-598f-44ef-bfa8-171df298fccd',
      api_client_id: '1001',
      billing_address_id: '1102',
      customer_id: 'efba485b-49e5-4067-8924-a5ba0f902f39',
      location_id: '1003',
      shipping_address_id: '3005',
      shop_id: 'b96532ea-c63f-4779-82f2-e3f10df6d833',
      user_id: 'd8b6a40a-3524-48ed-9bce-96b4eaebcd64',
      name: 'Seamus Shea',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'null',
      fulfillment_status: 'Partial',
      cancel_reason: 'other',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'e6ffbee7-ae2c-4483-afb3-61e71e968398',
      api_client_id: '1002',
      billing_address_id: '1103',
      customer_id: '5c45b87e-ccf9-4a87-bc40-00501aac5d90',
      location_id: '1004',
      shipping_address_id: '3003',
      shop_id: 'd6af23a1-815d-4543-85b9-f16c8b2df623',
      user_id: 'a795f17d-7524-4fbe-969a-fa615ee164c9',
      name: 'Tommy Bryan',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Unfulfilled',
      cancel_reason: 'other',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'e3434ff4-944f-4123-8921-192efebbe735',
      api_client_id: '1002',
      billing_address_id: '1101',
      customer_id: 'eafa901d-6dea-4be4-b9bf-181d63caeb5e',
      location_id: '1003',
      shipping_address_id: '3005',
      shop_id: '07f53333-e200-406a-b96c-3ee97f241321',
      user_id: 'd8b6a40a-3524-48ed-9bce-96b4eaebcd64',
      name: 'Seamus Shea',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'inventory',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'b168f0bb-fc47-4cb3-8447-89a385edac87',
      api_client_id: '1001',
      billing_address_id: '1101',
      customer_id: '86d070df-5f8a-4908-9bc1-2254d81d3381',
      location_id: '1005',
      shipping_address_id: '3006',
      shop_id: 'cb8d36fb-3b41-4f09-b450-b2ee062b1f7a',
      user_id: '3964025b-ac72-44d9-9420-2244d86e480c',
      name: 'Randall Underwood',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Unfulfilled',
      cancel_reason: 'customer',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: 'cdd07a97-1cfe-4389-84ed-55521cd998cc',
      api_client_id: '1001',
      billing_address_id: '1102',
      customer_id: '1f0c2ee7-5843-4c06-8fcc-af39932b775b',
      location_id: '1002',
      shipping_address_id: '3006',
      shop_id: '32ea27df-e02e-44cd-a486-2be483364733',
      user_id: '3964025b-ac72-44d9-9420-2244d86e480c',
      name: 'Randall Underwood',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Unfulfilled',
      cancel_reason: 'customer',
      processed_at: '44013.7111226852',
      canceled_at: '44015.7111226852',
      deleted_at: 'null',
      test: 'TRUE',
    },
    {
      order_id: '5dcd1222-8d12-4c09-a0ae-88388dceb24b',
      api_client_id: '1001',
      billing_address_id: '1102',
      customer_id: 'bb1456ca-16a4-4e9b-9e83-94cbc9debd64',
      location_id: '1005',
      shipping_address_id: 'null',
      shop_id: 'a5ddea02-1077-462c-b81a-5655a849a1c1',
      user_id: 'a795f17d-7524-4fbe-969a-fa615ee164c9',
      name: 'Tommy Bryan',
      total_price: '9.99',
      total_price_fx: '9.99',
      discount_code: 'SALE10OFF',
      fulfillment_status: 'Fulfilled',
      cancel_reason: 'null',
      processed_at: '44013.7111226852',
      canceled_at: 'null',
      deleted_at: 'null',
      test: 'TRUE',
    },
  ],
};

export const fetchData = () => {
  return schemaDetails;
};

export const handleColumnSelectionChange = (columnIds) => {
  let { columns } = schemaDetails;
  columns = columns.map((column) => {
    if (columnIds.includes(column.columnId)) {
      column.selected = !column.selected;

      return column;
    }

    return column;
  });

  return columns;
};

export const qualityDetails = {
  freshness: {
    heading: 'Freshness',
    lastRunsData: ['Success', 'Success', 'Success', 'Unknown', 'Failed'],
    lastRunResults: 'June 21, 2020 05:00 AM',
  },
  completeness: {
    heading: 'Completeness',
    lastRunsData: ['Success', 'Success', 'Success', 'Success', 'Success'],
    lastRunResults: 'June 21, 2020 05:00 AM',
  },
  duplicates: {
    heading: 'Duplicates',
    lastRunsData: ['Success', 'Success', 'Success', 'Success', 'Unknown'],
    lastRunResults: 'June 21, 2020 05:00 AM',
  },
  datacenterDetails: [
    {
      name: 'us-east-1a',
      latestRunsDetails: ['Success', 'Success', 'Success', 'Success', 'Failed'],
      lastResult: '-',
    },
    {
      name: 'us-west-2a',
      latestRunsDetails: [
        'Success',
        'Success',
        'Success',
        'Success',
        'Success',
      ],
      lastResult: '',
    },
    {
      name: 'row-count',
      latestRunsDetails: [
        'Success',
        'Success',
        'Success',
        'Success',
        'Success',
      ],
      lastResult: '',
    },
  ],
  testsDetails: [
    {
      name: 'order_uuid is uuid',
      description: 'Checking where UUID is in proper format',
      latestRunsDetails: [
        'Success',
        'Success',
        'Success',
        'Success',
        'Success',
      ],
      lastResult: 'June 21, 2020 05:00 AM',
      owner: 'Krishna',
    },
    {
      name: 'orders are within 30% day over day',
      description:
        'We are making sure all orders are loaded for a particular day. Impact:If this test fails ,this may be due to fact_order not being loaded all trips for that day.',
      latestRunsDetails: [
        'Success',
        'Success',
        'Success',
        'Success',
        'Success',
      ],
      lastResult: 'June 21, 2020 05:00 AM',
      owner: 'Sanket',
    },
    {
      name: 'fact_order_HIVE_TABLE_SECURE_cross_data_region_consistency',
      description:
        'Nulla dui nunc, mattis eu ex et, ornare dictum magna. Nunc iaculis condimentum lectus non eleifend. Vivamus placerat vitae arcu nec tincidunt. ' +
        'Donec id arcu sed quam lacinia condimentum eu id ligula.',
      latestRunsDetails: ['Success', 'Success', 'Success', 'Failed', 'Failed'],
      lastResult: 'June 21, 2020 05:00 AM',
      owner: 'Suresh',
    },
    {
      name: 'fact_order_HIVE_TABLE_SECURE_cross_data_region_consistency',
      description:
        'Nulla dui nunc, mattis eu ex et, ornare dictum magna. Nunc iaculis condimentum lectus non eleifend. Vivamus placerat vitae arcu nec tincidunt. ' +
        'Donec id arcu sed quam lacinia condimentum eu id ligula.',
      latestRunsDetails: ['Success', 'Success', 'Success', 'Failed', 'Failed'],
      lastResult: 'June 21, 2020 05:00 AM',
      owner: 'Suresh',
    },
  ],
};

export const issues = [
  {
    issueStatus: 'Open',
    issueTitle: 'Update the fact_orders description',
    issueTags: ['beginner-task', 'help-wanted'],
    issueNumber: 5590,
    issueOpenedOn: 'Yesterday',
    issueOpenedBy: 'Krishna',
    contributors: [
      {
        name: 'testUser',
        avatar:
          'https://www.caribbeangamezone.com/wp-content/uploads/2018/03/avatar-placeholder.png',
      },
      {
        name: 'testUser2',
        avatar:
          'https://www.caribbeangamezone.com/wp-content/uploads/2018/03/avatar-placeholder.png',
      },
    ],
    commentCount: 8,
  },
  {
    issueStatus: 'Closed',
    issueTitle: 'Update the fact_orders description',
    issueTags: [],
    issueNumber: 5590,
    issueOpenedOn: 'Yesterday',
    issueOpenedBy: 'Krishna',
    contributors: [],
    commentCount: 0,
  },
  {
    issueStatus: 'Open',
    issueTitle: 'Update the fact_orders description',
    issueTags: ['beginner-task'],
    issueNumber: 5590,
    issueOpenedOn: 'Today',
    issueOpenedBy: 'Suresh',
    contributors: [
      {
        name: 'testUser',
        avatar:
          'https://www.caribbeangamezone.com/wp-content/uploads/2018/03/avatar-placeholder.png',
      },
      {
        name: 'testUser2',
        avatar:
          'https://www.caribbeangamezone.com/wp-content/uploads/2018/03/avatar-placeholder.png',
      },
    ],
    commentCount: 30,
  },
];
