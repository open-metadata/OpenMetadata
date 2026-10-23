/*
 *  Copyright 2026 Collate.
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

/**
 * Seeds the showcase content the product tour's pages need and sample data
 * does not ingest: Context Center articles and approved memories, and data
 * quality tests with results on a few tables. Run it on
 * the instance you record the tour fixtures from, before recording, so those
 * steps show content rather than an empty state. Safe to run again: anything
 * already there is left alone.
 *
 *   OM_BASE_URL=http://localhost:8585 node scripts/product-tour/seedProductTourData.mjs
 *
 * Credentials default to the sample-data admin; override with OM_ADMIN_EMAIL
 * and OM_ADMIN_PASSWORD.
 */

const BASE_URL = `${process.env.OM_BASE_URL ?? 'http://localhost:8585'}/api/v1`;
const EMAIL = process.env.OM_ADMIN_EMAIL ?? 'admin@open-metadata.org';
const PASSWORD = process.env.OM_ADMIN_PASSWORD ?? 'admin';

const ARTICLES = [
  {
    name: 'product-tour-data-quality-playbook',
    displayName: 'Data Quality Playbook',
    description:
      'How we test our data and what happens when a test fails.\n\n' +
      '- Every certified table carries freshness, volume and null-rate tests.\n' +
      '- A failed test opens an incident, assigned to the table owner.\n' +
      '- Incidents are resolved, with a reason, within one business day.',
  },
  {
    name: 'product-tour-revenue-metric-definitions',
    displayName: 'Revenue Metric Definitions',
    description:
      'The definitions finance and analytics agree on.\n\n' +
      '- **ARR**: annualised value of active subscriptions at month end.\n' +
      '- **Net revenue retention**: this year’s revenue from last year’s customers, over last year’s revenue.\n' +
      '- **Active customer**: placed an order in the last 90 days.',
  },
  {
    name: 'product-tour-getting-started',
    displayName: 'Getting Started with the Data Platform',
    description:
      'Where to find data, who owns it, and how to ask for access.\n\n' +
      '1. Search Explore, and prefer assets marked certified.\n' +
      '2. Check the owner and the glossary terms on the asset page.\n' +
      '3. Request access from the asset page; the owner approves it.',
  },
];

const MEMORIES = [
  {
    name: 'product-tour-lifetime-value-source',
    title: 'Source of truth for customer lifetime value',
    question: 'Which table is the source of truth for customer lifetime value?',
    answer:
      'Use the finance mart’s customer lifetime value table; it is refreshed nightly and reconciled with billing.',
    memoryType: 'Learning',
  },
  {
    name: 'product-tour-fiscal-year',
    title: 'Fiscal year',
    question: 'When does the fiscal year start?',
    answer: 'The fiscal year starts on February 1; quarters follow from there.',
    memoryType: 'Faq',
  },
  {
    name: 'product-tour-active-customer',
    title: 'Active customer',
    question: 'What counts as an active customer?',
    answer: 'A customer who placed an order in the last 90 days.',
    memoryType: 'Faq',
  },
];

// Row-count tests on the first tables, one failing, so the Data Quality
// dashboard shows coverage, healthy and unhealthy assets, and test results.
const TEST_CASE_NAME = 'product-tour-row-count';
const TEST_RESULTS = [
  {
    testCaseStatus: 'Success',
    result: 'Found 12,840 rows, within 1 and 1,000,000.',
  },
  {
    testCaseStatus: 'Success',
    result: 'Found 3,215 rows, within 1 and 1,000,000.',
  },
  { testCaseStatus: 'Failed', result: 'Found 0 rows, below the minimum of 1.' },
  {
    testCaseStatus: 'Success',
    result: 'Found 98,310 rows, within 1 and 1,000,000.',
  },
];

const request = async (token, method, path, body) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `${method} ${path}: ${response.status} ${await response.text()}`
    );
  }

  return response.status === 404 ? undefined : response.json();
};

const signIn = async () => {
  const { accessToken } = await request(undefined, 'POST', '/users/login', {
    email: EMAIL,
    password: Buffer.from(PASSWORD).toString('base64'),
  });

  return accessToken;
};

const seed = async (token, label, existsPath, createPath, items, toRequest) => {
  for (const item of items) {
    const existing = await request(token, 'GET', `${existsPath}/${item.name}`);
    if (existing) {
      console.log(`${label} ${item.name}: already there`);
    } else {
      await request(token, 'POST', createPath, toRequest(item));
      console.log(`${label} ${item.name}: created`);
    }
  }
};

const seedDataQuality = async (token) => {
  const { data: tables } = await request(
    token,
    'GET',
    `/tables?limit=${TEST_RESULTS.length}`
  );
  for (const [index, table] of tables.entries()) {
    const testCaseFqn = `${table.fullyQualifiedName}.${TEST_CASE_NAME}`;
    const encodedFqn = encodeURIComponent(testCaseFqn);
    const existing = await request(
      token,
      'GET',
      `/dataQuality/testCases/name/${encodedFqn}`
    );
    if (existing) {
      console.log(`test ${testCaseFqn}: already there`);
      continue;
    }
    await request(token, 'POST', '/dataQuality/testCases', {
      name: TEST_CASE_NAME,
      testDefinition: 'tableRowCountToBeBetween',
      entityLink: `<#E::table::${table.fullyQualifiedName}>`,
      parameterValues: [
        { name: 'minValue', value: '1' },
        { name: 'maxValue', value: '1000000' },
      ],
    });
    await request(
      token,
      'POST',
      `/dataQuality/testCases/testCaseResults/${encodedFqn}`,
      { timestamp: Date.now(), ...TEST_RESULTS[index] }
    );
    console.log(`test ${testCaseFqn}: created`);
  }
};

const token = await signIn();
await seed(
  token,
  'article',
  '/contextCenter/pages/name',
  '/contextCenter/pages',
  ARTICLES,
  (article) => ({ ...article, pageType: 'Article', page: {} })
);
await seed(
  token,
  'memory',
  '/contextCenter/memories/name',
  '/contextCenter/memories',
  MEMORIES,
  (memory) => ({ ...memory, entityStatus: 'Approved', sourceType: 'Manual' })
);
await seedDataQuality(token);
