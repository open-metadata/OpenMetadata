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

const mockData = [
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
    dataId: 3,
    dataName: 'hourly_sales',
    badgeName: 'query',
    likeCount: 487,
    description: '',
    miscDetails: [],
    queryDetails: {
      tagList: ['Dispatch', 'Health', 'Market'],
      lastRunBy: 'Sanket',
      lastRunOn: 'Jan 15, 2019 1:25pm',
      rowCount: 1454,
      colCount: 15,
      datatypeCount: 3,
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
  {
    dataId: 4,
    dataName: 'product_categories',
    badgeName: 'query',
    likeCount: 487,
    description: '',
    miscDetails: [],
    queryDetails: {
      tagList: ['Dispatch', 'Health', 'Market'],
      lastRunBy: 'Suresh',
      lastRunOn: 'Jan 15, 2019 1:25pm',
      rowCount: 1454,
      colCount: 15,
      datatypeCount: 3,
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
  {
    dataId: 5,
    dataName: 'top_selling_products',
    badgeName: 'dashboard',
    likeCount: 635,
    description:
      'Dashboard captures the top selling products across the marketplace per hour',
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

export default mockData;

// Mock data for tests
export const statData = {
  testdata1: {
    badgeName: 'table',
    generalStats: { numberOfRuns: '0', sharedWithUsersCount: '0' },
    tableStats: { instanceCount: '18', status: 'Ready to Use' },
  },
  testdata2: {
    badgeName: 'query',
    generalStats: {
      numberOfRuns: '5432',
      sharedWithUsersCount: '24',
    },
    tableStats: {
      instanceCount: '0',
      status: '',
    },
  },
};

export const queryDetailsData = {
  testdata1: {
    tagList: [],
    lastRunBy: 'Suresh',
    lastRunOn: 'Jan 15, 2019 1:25pm',
    rowCount: '1454',
    colCount: '15',
    datatypeCount: '3',
  },
  testdata2: {
    tagList: ['Dispatch', 'Health', 'Market'],
    lastRunBy: 'Sanket',
    lastRunOn: 'Jan 25, 2020 3:45am',
    rowCount: '1234',
    colCount: '54',
    datatypeCount: '7',
  },
};

export const miscDetailsData = {
  testdata1: {
    title: 'Owner',
    text: 'Shops Org',
    separator: true,
  },
  testdata2: {
    title: 'Platform',
    text: 'HIVE',
    separator: false,
  },
  testdata3: {
    title: 'Tier',
    text: 'Tier1',
  },
};

export const descriptionData = {
  testdata1: {
    description: 'Metric to determine rate of checkouts across the marketplace',
    tier: 'Tier1',
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
        key: 'Freshness',
        value: '31h',
      },
    ],
  },
  testdata2: {
    description:
      'Dashboard captures the top selling products across the marketplace per hour',
    miscDetails: [],
  },
};

export const dataDetails = {
  testdata1: {
    name: 'fact_order',
    description:
      'General information about orders. Do not use this table for financial calculations (use the sales table instead)',
    owner: {
      name: 'user123',
    },
    tier: 'Tier1',
    usage: {
      percentileRank: 25.3256478546,
    },
    tableType: 'REGULAR',
    fullyQualifiedName: 'gold.fact_order',
  },
  testdata2: {
    name: 'product_categories',
    description:
      'General information about orders. Do not use this table for financial calculations (use the sales table instead)',
    owner: {
      name: 'user123',
    },
    tier: 'Tier1',
    usage: {
      percentileRank: 98.45784545,
    },
    tableType: 'QUERY',
    fullyQualifiedName: 'gold.product_categories',
  },
  testdata3: {
    name: 'customer_cart_checkout',
    description:
      'General information about orders. Do not use this table for financial calculations (use the sales table instead)',
    owner: {
      name: 'user123',
    },
    tier: 'Tier1',
    usage: {
      percentileRank: 9.232648488,
    },
    tableType: 'REGULAR',
    fullyQualifiedName: 'gold.customer_cart_checkout',
  },
};

export const dummyData = {
  miscDetails: [
    {
      key: 'Platform',
      value: '--',
    },
  ],
  queryDetails: {
    tagList: ['--', '--', '--'],
    lastRunBy: '--',
    lastRunOn: '--',
    rowCount: '--',
    colCount: '--',
    datatypeCount: '--',
  },
  generalStats: {
    numberOfRuns: '--',
    sharedWithUsersCount: '--',
  },
  tableStats: { instanceCount: '--', status: '--' },
};
