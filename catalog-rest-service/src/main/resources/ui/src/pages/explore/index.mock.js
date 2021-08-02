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
  hits: {
    hits: {
      tableId: '09ac866c-a18d-4470-abc8-52deed3d90d6',
      database: 'dwh',
      tableName: 'fact_sale',
      serviceName: 'MYSQL',
      description: 'this is the table to hold data on fact_sale',
      tableType: 'null',
    },
  },
};
