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

/* eslint-disable max-len */
export const MOCK_QUERIES = [
  {
    id: '51286e5d-0590-457b-a1ec-bc53c1effa1e',
    name: '0fa0c186788e8397a99b97b62997f9aa',
    fullyQualifiedName: '0fa0c186788e8397a99b97b62997f9aa',
    version: 0.3,
    updatedAt: 1679382453548,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/queries/51286e5d-0590-457b-a1ec-bc53c1effa1e',
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [],
      fieldsDeleted: [
        {
          name: 'tags',
          oldValue:
            '[{"tagFQN":"test.term2","description":"term2","source":"Glossary","labelType":"Manual","state":"Confirmed"}]',
        },
      ],
      previousVersion: 0.2,
    },
    owner: {
      id: '471353cb-f925-4c4e-be6c-14da2c0b00ce',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/471353cb-f925-4c4e-be6c-14da2c0b00ce',
    },
    votes: {
      upVotes: 1,
      downVotes: 1,
      upVoters: [
        {
          id: 'cdccaedd-ed02-4c89-bc1a-1c4cd679d1e3',
          type: 'user',
          name: 'shailesh.parmar',
          fullyQualifiedName: 'shailesh.parmar',
          displayName: 'ShaileshParmar',
          deleted: false,
        },
      ],
      downVoters: [
        {
          id: '4f277812-6670-4f28-a11b-459d537b7ba9',
          type: 'user',
          name: 'admin',
          fullyQualifiedName: 'admin',
          deleted: false,
        },
      ],
    },
    query:
      'SELECT\nc.calendar_date,\nc.calendar_year,\nc.calendar_month,\nc.calendar_dayname,\nCOUNT(DISTINCT sub.order_id) AS num_orders,\nCOUNT(sub.book_id) AS num_books,\nSUM(sub.price) AS total_price,\nSUM(COUNT(sub.book_id)) OVER (\n  PARTITION BY c.calendar_year, c.calendar_month\n  ORDER BY c.calendar_date\n) AS running_total_num_books,\nLAG(COUNT(sub.book_id), 7) OVER (ORDER BY c.calendar_date) AS prev_books\nFROM calendar_days c\nLEFT JOIN (\n  SELECT\n  co.order_date,\n  co.order_id,\n  ol.book_id,\n  ol.price\n  FROM cust_order co\n  INNER JOIN order_line ol ON co.order_id = ol.order_id\n) sub ON c.calendar_date = sub.order_date\nGROUP BY c.calendar_date, c.calendar_year, c.calendar_month, c.calendar_dayname\nORDER BY c.calendar_date ASC;',
    checksum: '0fa0c186788e8397a99b97b62997f9aa',
    tags: [
      {
        tagFQN: 'PersonalData.Personal',
        description:
          'Data that can be used to directly or indirectly identify a person.',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      },
    ],
    queryUsedIn: [
      {
        id: '6bd26d1a-777c-407d-bede-fada48f31390',
        type: 'table',
        name: 'dim.api/client',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.api/client"',
        description:
          'This dimension table contains a row for each channel or app that your customers use to create orders. Some examples of these include Facebook and Online Store. You can join this table with the sales table to measure channel performance.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/6bd26d1a-777c-407d-bede-fada48f31390',
      },
      {
        id: '9021248e-fa10-4549-b4ed-d41b116ca4c7',
        type: 'table',
        name: 'dim.product.variant',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify."dim.product.variant"',
        description:
          'This dimension table contains current information about each of the product variants in your store. This table contains one row per product variant.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/9021248e-fa10-4549-b4ed-d41b116ca4c7',
      },
      {
        id: 'dd6551e9-1bee-4ba1-baf2-6f1ad45c5b7a',
        type: 'table',
        name: 'dim_address',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
        description:
          'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/dd6551e9-1bee-4ba1-baf2-6f1ad45c5b7a',
      },
      {
        id: 'ecb4618a-12b9-4f60-a2a6-53a9e737dbf0',
        type: 'table',
        name: 'dim_address_clean',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address_clean',
        description: 'Created from dim_address after a small cleanup.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/ecb4618a-12b9-4f60-a2a6-53a9e737dbf0',
      },
      {
        id: 'bf97283f-5c24-49e9-a665-665dd7467d16',
        type: 'table',
        name: 'dim_customer',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
        description:
          'The dimension table contains data about your customers. The customers table contains one row per customer. It includes historical metrics (such as the total amount that each customer has spent in your store) as well as forward-looking metrics (such as the predicted number of days between future orders and the expected order value in the next 30 days). This table also includes columns that segment customers into various categories (such as new, returning, promising, at risk, dormant, and loyal), which you can use to target marketing activities.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/bf97283f-5c24-49e9-a665-665dd7467d16',
      },
      {
        id: 'a6a6fd33-90c0-4fac-94ab-b254af4e13fb',
        type: 'table',
        name: 'fact_order',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_order',
        description:
          'The orders table contains information about each order in your store. Although this table is good for generating order lists and joining with the dim_customer, use the sales table instead for computing financial or other metrics.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/a6a6fd33-90c0-4fac-94ab-b254af4e13fb',
      },
      {
        id: 'ea600008-328b-4c70-8fa9-9207927329be',
        type: 'table',
        name: 'fact_sale',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        description:
          'The fact table captures the value of products sold or returned, as well as the values of other charges such as taxes and shipping costs. The sales table contains one row per order line item, one row per returned line item, and one row per shipping charge. Use this table when you need financial metrics.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/ea600008-328b-4c70-8fa9-9207927329be',
      },
      {
        id: '52c43deb-b28f-4bde-bc92-dc7751fd8eca',
        type: 'table',
        name: 'raw_customer',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_customer',
        description:
          'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/52c43deb-b28f-4bde-bc92-dc7751fd8eca',
      },
      {
        id: '551dd98c-1817-4252-9bd2-cb4bc548c8d5',
        type: 'table',
        name: 'raw_product_catalog',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.raw_product_catalog',
        description:
          'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/551dd98c-1817-4252-9bd2-cb4bc548c8d5',
      },
    ],
    deleted: false,
  },
  {
    id: '44c71a8d-130a-4857-aa88-23bf7e371d5e',
    name: '0fb30e385cb4ec0cf11fce9009cf23ea',
    fullyQualifiedName: '0fb30e385cb4ec0cf11fce9009cf23ea',
    version: 0.2,
    updatedAt: 1679304951803,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/queries/44c71a8d-130a-4857-aa88-23bf7e371d5e',
    changeDescription: {
      fieldsAdded: [
        {
          name: 'tags',
          newValue:
            '[{"tagFQN":"PII.NonSensitive","source":"Classification","labelType":"Manual","state":"Confirmed"},{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","labelType":"Manual","state":"Confirmed"}]',
        },
      ],
      fieldsUpdated: [],
      fieldsDeleted: [],
      previousVersion: 0.1,
    },
    votes: {
      upVotes: 1,
      downVotes: 1,
      upVoters: [
        {
          id: 'cdccaedd-ed02-4c89-bc1a-1c4cd679d1e3',
          type: 'user',
          name: 'shailesh.parmar',
          fullyQualifiedName: 'shailesh.parmar',
          displayName: 'ShaileshParmar',
          deleted: false,
        },
      ],
      downVoters: [
        {
          id: '4f277812-6670-4f28-a11b-459d537b7ba9',
          type: 'user',
          name: 'admin',
          fullyQualifiedName: 'admin',
          deleted: false,
        },
      ],
    },
    query: 'select * from example',
    checksum: '0fb30e385cb4ec0cf11fce9009cf23ea',
    tags: [
      {
        tagFQN: 'PersonalData.SpecialCategory',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination.',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      },
      {
        tagFQN: 'PII.NonSensitive',
        description:
          'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      },
    ],
    queryUsedIn: [
      {
        id: '6bd26d1a-777c-407d-bede-fada48f31390',
        type: 'table',
        name: 'dim.api/client',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.api/client"',
        description:
          'This dimension table contains a row for each channel or app that your customers use to create orders. Some examples of these include Facebook and Online Store. You can join this table with the sales table to measure channel performance.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/6bd26d1a-777c-407d-bede-fada48f31390',
      },
      {
        id: '9021248e-fa10-4549-b4ed-d41b116ca4c7',
        type: 'table',
        name: 'dim.product.variant',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify."dim.product.variant"',
        description:
          'This dimension table contains current information about each of the product variants in your store. This table contains one row per product variant.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/9021248e-fa10-4549-b4ed-d41b116ca4c7',
      },
      {
        id: 'dd6551e9-1bee-4ba1-baf2-6f1ad45c5b7a',
        type: 'table',
        name: 'dim_address',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
        description:
          'This dimension table contains the billing and shipping addresses of customers. You can join this table with the sales table to generate lists of the billing and shipping addresses. Customers can enter their addresses more than once, so the same address can appear in more than one row in this table. This table contains one row per customer address.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/dd6551e9-1bee-4ba1-baf2-6f1ad45c5b7a',
      },
      {
        id: 'ecb4618a-12b9-4f60-a2a6-53a9e737dbf0',
        type: 'table',
        name: 'dim_address_clean',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address_clean',
        description: 'Created from dim_address after a small cleanup.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/ecb4618a-12b9-4f60-a2a6-53a9e737dbf0',
      },
      {
        id: 'bf97283f-5c24-49e9-a665-665dd7467d16',
        type: 'table',
        name: 'dim_customer',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
        description:
          'The dimension table contains data about your customers. The customers table contains one row per customer. It includes historical metrics (such as the total amount that each customer has spent in your store) as well as forward-looking metrics (such as the predicted number of days between future orders and the expected order value in the next 30 days). This table also includes columns that segment customers into various categories (such as new, returning, promising, at risk, dormant, and loyal), which you can use to target marketing activities.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/bf97283f-5c24-49e9-a665-665dd7467d16',
      },
      {
        id: 'a6a6fd33-90c0-4fac-94ab-b254af4e13fb',
        type: 'table',
        name: 'fact_order',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_order',
        description:
          'The orders table contains information about each order in your store. Although this table is good for generating order lists and joining with the dim_customer, use the sales table instead for computing financial or other metrics.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/a6a6fd33-90c0-4fac-94ab-b254af4e13fb',
      },
      {
        id: 'ea600008-328b-4c70-8fa9-9207927329be',
        type: 'table',
        name: 'fact_sale',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.fact_sale',
        description:
          'The fact table captures the value of products sold or returned, as well as the values of other charges such as taxes and shipping costs. The sales table contains one row per order line item, one row per returned line item, and one row per shipping charge. Use this table when you need financial metrics.',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/ea600008-328b-4c70-8fa9-9207927329be',
      },
      {
        id: '52c43deb-b28f-4bde-bc92-dc7751fd8eca',
        type: 'table',
        name: 'raw_customer',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_customer',
        description:
          'This is a raw customers table as represented in our online DB. This contains personal, shipping and billing addresses and details of the customer store and customer profile. This table is used to build our dimensional and fact tables',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/52c43deb-b28f-4bde-bc92-dc7751fd8eca',
      },
      {
        id: '551dd98c-1817-4252-9bd2-cb4bc548c8d5',
        type: 'table',
        name: 'raw_product_catalog',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.raw_product_catalog',
        description:
          'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
        deleted: false,
        href: 'http://localhost:8585/api/v1/tables/551dd98c-1817-4252-9bd2-cb4bc548c8d5',
      },
    ],
    deleted: false,
  },
];

export const MOCK_QUERIES_ES_DATA = MOCK_QUERIES.map((data) => ({
  _source: data,
}));
