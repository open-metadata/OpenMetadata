/*
 *  Copyright 2021 Collate
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

/* eslint-disable @typescript-eslint/camelcase */

const todayData = [
  {
    dataId: 1,
    dataName: 'fact_order',
    badgeName: 'table',
    likeCount: 234,
    description:
      'General information about orders. Do not use this table for financial calculations (use the sales table instead)',
    miscDetails: [
      {
        key: 'Owner',
        value: 'Shops Org',
      },
      {
        key: 'Super Org',
        value: 'Data',
      },
      {
        key: 'Platform',
        value: 'HIVE',
      },
      {
        key: 'Highly used',
        value: '99th Percetile',
      },
      {
        key: 'Tier',
        value: 'Tier1',
      },
      {
        key: 'Freshness',
        value: '31h',
      },
    ],
    queryDetails: {
      tagList: [],
      lastRunBy: '',
      lastRunOn: '',
      rowCount: 0,
      colCount: 0,
      datatypeCount: 0,
    },
    generalStats: { numberOfRuns: 0, sharedWithUsersCount: 0 },
    tableStats: { instanceCount: 18, status: 'Ready to Use' },
  },
  {
    dataId: 2,
    dataName: 'dim_customer',
    badgeName: 'table',
    likeCount: 546,
    description:
      'Current customer information including historical information about their orders, as well as predictive metrics',
    miscDetails: [
      {
        key: 'Owner',
        value: 'Shops Org',
      },
      {
        key: 'Super Org',
        value: 'Data',
      },
      {
        key: 'Platform',
        value: 'HIVE',
      },
      {
        key: 'Highly used',
        value: '99th Percetile',
      },
      {
        key: 'Tier',
        value: 'Tier1',
      },
      {
        key: 'Freshness',
        value: '31h',
      },
    ],
    queryDetails: {
      tagList: [],
      lastRunBy: '',
      lastRunOn: '',
      rowCount: 0,
      colCount: 0,
      datatypeCount: 0,
    },
    generalStats: { numberOfRuns: 0, sharedWithUsersCount: 0 },
    tableStats: {
      instanceCount: 18,
      status: 'Failing',
    },
  },
  {
    dataId: 6,
    dataName: 'customer_cart_checkout',
    badgeName: 'metrics',
    likeCount: 389,
    description: 'Metric to determine rate of checkouts across the marketplace',
    miscDetails: [
      {
        key: 'Owner',
        value: 'Shops Org',
      },
      {
        key: 'Super Org',
        value: 'Data',
      },
      {
        key: 'Platform',
        value: 'HIVE',
      },
      {
        key: 'Highly used',
        value: '99th Percetile',
      },
      {
        key: 'Tier',
        value: 'Tier1',
      },
      {
        key: 'Freshness',
        value: '31h',
      },
    ],
    queryDetails: {
      tagList: [],
      lastRunBy: '',
      lastRunOn: '',
      rowCount: 0,
      colCount: 0,
      datatypeCount: 0,
    },
    generalStats: {
      numberOfRuns: 5432,
      sharedWithUsersCount: 24,
    },
    tableStats: {
      instanceCount: 0,
      status: '',
    },
  },
];

export const fetchData = (
  searchText,
  isFavouriteOnly,
  isSearchMyData,
  sortOrder
) => {
  if (
    searchText !== '' ||
    isFavouriteOnly ||
    isSearchMyData ||
    sortOrder !== ''
  ) {
    return [
      {
        dateTitle: 'Today',
        data: todayData,
      },
    ];
  }
};

export const entitiesData = [
  {
    name: 'Data Set',
    color: '#7558C1',
    value: Math.floor(Math.random() * 1000) + 1,
  },
  {
    name: 'Metrics',
    color: '#00977E',
    value: Math.floor(Math.random() * 1000) + 1,
  },
  {
    name: 'Reports',
    color: '#E9A800',
    value: Math.floor(Math.random() * 1000) + 1,
  },
  {
    name: 'Dashboards',
    color: '#C45296',
    value: Math.floor(Math.random() * 1000) + 1,
  },
  {
    name: 'ML Features',
    color: '#2EAADC',
    value: Math.floor(Math.random() * 1000) + 1,
  },
];

export const tiers = ['Tier1', 'Tier2', 'Tier3', 'Tier4', 'Tier5'];
export const mockResponse = {
  data: {
    hits: {
      total: {
        value: 15,
        relation: 'eq',
      },
      max_score: 5,
      hits: [
        {
          _index: 'table_search_index',
          _type: '_doc',
          _id: 'b5860f51-a197-48c8-9506-ee67da190d83',
          _score: 5,
          _source: {
            table_id: 'b5860f51-a197-48c8-9506-ee67da190d83',
            database: 'bigquery.shopify',
            service: 'bigquery',
            service_type: 'BigQuery',
            table_name: 'dim_address',
            suggest: [
              {
                input: ['bigquery.shopify.dim_address'],
                weight: 5,
              },
              {
                input: ['dim_address'],
                weight: 10,
              },
            ],
            description:
              'This dimension table contains the billing and shipping addresses of customers. You can join this table.',
            table_type: 'Regular',
            last_updated_timestamp: 1634886627,
            column_names: ['address_id', 'shop_id'],
            column_descriptions: [
              'Unique identifier for the address.',
              'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
            ],
            tags: [],
            fqdn: 'bigquery.shopify.dim_address',
            tier: null,
            schema_description: null,
            owner: '',
            followers: [],
          },
        },
      ],
    },
    aggregations: {
      'sterms#Tier': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [],
      },
      'sterms#Service': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          {
            key: 'BigQuery',
            doc_count: 15,
          },
        ],
      },
      'sterms#Tags': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [],
      },
    },
  },
};
