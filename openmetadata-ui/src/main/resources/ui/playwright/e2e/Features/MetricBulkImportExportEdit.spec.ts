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
import {
  APIRequestContext,
  APIResponse,
  expect,
  Locator,
  Page,
} from '@playwright/test';
import * as fs from 'fs';

import { RDG_ACTIVE_CELL_SELECTOR } from '../../constant/bulkImportExport';
import { VIEW_ONLY_RULE } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { UserClass } from '../../support/user/UserClass';
import { createAdminApiContext } from '../../utils/admin';
import {
  redirectToHomePage,
  uuid,
  waitForMetricsSearchResponse,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { verifyPageAccess } from '../../utils/testCases';
import { test } from '../fixtures/pages';

interface EntityReference {
  id: string;
  type: string;
  name: string;
  fullyQualifiedName?: string;
  displayName?: string;
}

interface EntityList<T> {
  data: T[];
  paging: {
    after?: string;
    total?: number;
  };
}

interface MetricExpression {
  code?: string;
  language?: string;
}

interface TagLabelResponse {
  tagFQN: string;
  source: string;
}

interface MetricResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
  dataProducts?: EntityReference[];
  domains?: EntityReference[];
  displayName?: string;
  entityStatus?: string;
  extension?: Record<string, unknown>;
  granularity?: string;
  metricExpression?: MetricExpression;
  metricType?: string;
  owners?: EntityReference[];
  relatedMetrics?: EntityReference[];
  reviewers?: EntityReference[];
  tags?: TagLabelResponse[];
  unitOfMeasurement?: string;
}

interface TagResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
}

interface GlossaryResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
}

interface GlossaryTermResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
}

interface DomainResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
}

interface DataProductResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
}

interface CustomPropertyResponse {
  name: string;
  propertyType?: {
    id?: string;
    name?: string;
    type?: string;
  };
}

interface MetadataTypeResponse {
  id: string;
  name: string;
  customProperties?: CustomPropertyResponse[];
}

interface MetadataTypeListResponse {
  data: MetadataTypeResponse[];
}

interface MetricBulkFixtures {
  prefix: string;
  metrics: MetricResponse[];
  tag: TagResponse;
  secondTag: TagResponse;
  glossary: GlossaryResponse;
  glossaryTerm: GlossaryTermResponse;
  nestedGlossaryTerm: GlossaryTermResponse;
  domain: DomainResponse;
  dataProduct: DataProductResponse;
  owner: EntityReference;
  reviewer: EntityReference;
}

const METRIC_FIXTURE_COUNT = 18;
const CSV_HEADERS = [
  'name*',
  'displayName',
  'description',
  'metricType',
  'unitOfMeasurement',
  'customUnitOfMeasurement',
  'granularity',
  'expressionLanguage',
  'expressionCode',
  'relatedMetrics',
  'tags',
  'glossaryTerms',
  'tiers',
  'owners',
  'reviewers',
  'domains',
  'dataProducts',
  'entityStatus',
  'extension',
];

const METRIC_EDITOR_RULES = [
  {
    name: `metric-editor-${uuid()}`,
    resources: ['metric'],
    operations: ['ViewAll', 'ViewBasic', 'Create', 'EditAll', 'Delete'],
    effect: 'allow',
  },
];

let apiContext: APIRequestContext;
let disposeApiContext: () => Promise<void>;
let fixtures: MetricBulkFixtures;
let viewOnlyUser: UserClass;
let viewOnlyPolicy: PolicyClass;
let viewOnlyRole: RolesClass;
let metricEditorUser: UserClass;
let metricEditorPolicy: PolicyClass;
let metricEditorRole: RolesClass;
let metricTypeId: string | undefined;
let metricCustomPropertyName: string;

const parseResponse = async <T>(
  response: APIResponse,
  label: string
): Promise<T> => {
  if (!response.ok()) {
    throw new Error(
      `${label} failed (${response.status()}): ${await response.text()}`
    );
  }

  return (await response.json()) as T;
};

const getNameSuffix = () => uuid().replaceAll('-', '_').slice(0, 12);

const createEntityReference = (
  entity: Pick<
    EntityReference,
    'displayName' | 'fullyQualifiedName' | 'id' | 'name'
  >,
  type: string
): EntityReference => ({
  id: entity.id,
  type,
  name: entity.name,
  fullyQualifiedName: entity.fullyQualifiedName ?? entity.name,
  displayName: entity.displayName,
});

const createTagLabel = (tagFQN: string, source = 'Classification') => ({
  tagFQN,
  source,
  labelType: 'Manual',
  state: 'Confirmed',
});

const csvCell = (value: string) =>
  /[",;\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

const createCsv = (rows: string[][]) =>
  [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');

const createTag = async (name: string, color: string): Promise<TagResponse> =>
  parseResponse<TagResponse>(
    await apiContext.post('/api/v1/tags', {
      data: {
        classification: 'PII',
        name,
        displayName: name,
        description: `${name} tag for metric bulk tests.`,
        mutuallyExclusive: false,
        style: {
          color,
        },
      },
    }),
    `create tag ${name}`
  );

const createMetricStringCustomProperty = async (propertyName: string) => {
  const fieldTypes = await parseResponse<MetadataTypeListResponse>(
    await apiContext.get('/api/v1/metadata/types?category=field&limit=20'),
    'list metadata field types'
  );
  const stringType = fieldTypes.data.find((type) => type.name === 'string');

  if (!stringType) {
    throw new Error('String custom property type is missing');
  }

  const metricType = await parseResponse<MetadataTypeResponse>(
    await apiContext.get(
      '/api/v1/metadata/types/name/metric?fields=customProperties'
    ),
    'fetch metric metadata type'
  );

  metricTypeId = metricType.id;

  await parseResponse<MetadataTypeResponse>(
    await apiContext.put(`/api/v1/metadata/types/${metricType.id}`, {
      data: {
        name: propertyName,
        description: `${propertyName} for metric bulk tests.`,
        propertyType: {
          id: stringType.id,
          type: 'type',
        },
      },
    }),
    'create metric custom property'
  );
};

const cleanupMetricCustomProperty = async () => {
  if (!metricTypeId || !metricCustomPropertyName) {
    return;
  }

  const metricType = await parseResponse<MetadataTypeResponse>(
    await apiContext.get(
      '/api/v1/metadata/types/name/metric?fields=customProperties'
    ),
    'fetch metric metadata type for cleanup'
  );
  const propertyIndex = metricType.customProperties?.findIndex(
    (property) => property.name === metricCustomPropertyName
  );

  if (propertyIndex === undefined || propertyIndex < 0) {
    return;
  }

  const response = await apiContext.patch(
    `/api/v1/metadata/types/${metricType.id}`,
    {
      data: [
        {
          op: 'remove',
          path: `/customProperties/${propertyIndex}`,
        },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    }
  );

  if (!response.ok()) {
    throw new Error(
      `cleanup metric custom property failed: ${await response.text()}`
    );
  }
};

const createFixtures = async (
  customPropertyName: string
): Promise<MetricBulkFixtures> => {
  const prefix = `pw_metric_bulk_${getNameSuffix()}`;
  const [users, teams] = await Promise.all([
    parseResponse<EntityList<EntityReference>>(
      await apiContext.get('/api/v1/users?limit=5'),
      'list users'
    ),
    parseResponse<EntityList<EntityReference>>(
      await apiContext.get('/api/v1/teams?limit=5'),
      'list teams'
    ),
  ]);
  const owner = users.data[0];
  const reviewer = teams.data[0];

  const glossary = await parseResponse<GlossaryResponse>(
    await apiContext.post('/api/v1/glossaries', {
      data: {
        name: `${prefix}_glossary`,
        displayName: `${prefix} glossary`,
        description: 'Glossary for metric import/export/bulk edit tests.',
        mutuallyExclusive: false,
      },
    }),
    'create glossary'
  );

  const glossaryTerm = await parseResponse<GlossaryTermResponse>(
    await apiContext.post('/api/v1/glossaryTerms', {
      data: {
        name: `${prefix}_revenue`,
        displayName: `${prefix} Revenue`,
        description: 'Revenue parent glossary term.',
        glossary: glossary.name,
        mutuallyExclusive: false,
        style: {
          color: '#7F56D9',
        },
      },
    }),
    'create glossary term'
  );

  const nestedGlossaryTerm = await parseResponse<GlossaryTermResponse>(
    await apiContext.post('/api/v1/glossaryTerms', {
      data: {
        name: `${prefix}_net_revenue`,
        displayName: `${prefix} Net Revenue`,
        description: 'Nested revenue glossary term.',
        glossary: glossary.name,
        parent: glossaryTerm.fullyQualifiedName,
        mutuallyExclusive: false,
        style: {
          color: '#0BA5EC',
        },
      },
    }),
    'create nested glossary term'
  );

  const [tag, secondTag] = await Promise.all([
    createTag(`${prefix}_amber`, '#F79009'),
    createTag(`${prefix}_blue`, '#2E90FA'),
  ]);

  const domain = await parseResponse<DomainResponse>(
    await apiContext.post('/api/v1/domains', {
      data: {
        name: `${prefix}_domain`,
        displayName: `${prefix} Domain`,
        description: 'Domain for metric import/export/bulk edit tests.',
        domainType: 'Aggregate',
      },
    }),
    'create domain'
  );

  const dataProduct = await parseResponse<DataProductResponse>(
    await apiContext.post('/api/v1/dataProducts', {
      data: {
        name: `${prefix}_data_product`,
        displayName: `${prefix} Data Product`,
        description: 'Data product for metric import/export/bulk edit tests.',
        domains: [domain.fullyQualifiedName],
      },
    }),
    'create data product'
  );

  const metrics: MetricResponse[] = [];
  for (let index = 0; index < METRIC_FIXTURE_COUNT; index++) {
    const unitOfMeasurement = index % 4 === 0 ? 'OTHER' : 'DOLLARS';
    const metric = await parseResponse<MetricResponse>(
      await apiContext.post('/api/v1/metrics', {
        data: {
          name: `${prefix}_${index}`,
          displayName: `${prefix} Metric ${index}`,
          description: `Metric bulk fixture ${index}`,
          metricExpression: {
            language: 'SQL',
            code: `SELECT SUM(amount) AS metric_${index} FROM metric_bulk_orders`,
          },
          metricType: index % 2 === 0 ? 'SUM' : 'COUNT',
          unitOfMeasurement,
          customUnitOfMeasurement:
            unitOfMeasurement === 'OTHER' ? 'points' : undefined,
          granularity: index % 2 === 0 ? 'DAY' : 'MONTH',
          owners: [createEntityReference(owner, 'user')],
          reviewers: [createEntityReference(reviewer, 'team')],
          tags: [
            createTagLabel(
              index % 2 === 0
                ? tag.fullyQualifiedName
                : secondTag.fullyQualifiedName
            ),
            createTagLabel(nestedGlossaryTerm.fullyQualifiedName, 'Glossary'),
            createTagLabel('Tier.Tier2'),
          ],
          domains: [domain.fullyQualifiedName],
          dataProducts: [dataProduct.fullyQualifiedName],
          extension:
            index % 3 === 0
              ? {
                  [customPropertyName]: `${prefix} custom property ${index}`,
                }
              : undefined,
        },
      }),
      `create metric ${index}`
    );
    metrics.push(metric);
  }

  await parseResponse<MetricResponse>(
    await apiContext.patch(
      `/api/v1/metrics/name/${metrics[0].fullyQualifiedName}`,
      {
        data: [
          {
            op: 'replace',
            path: '/relatedMetrics',
            value: [
              createEntityReference(metrics[1], 'metric'),
              createEntityReference(metrics[2], 'metric'),
            ],
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    ),
    'patch related metrics'
  );

  return {
    prefix,
    metrics,
    tag,
    secondTag,
    glossary,
    glossaryTerm,
    nestedGlossaryTerm,
    domain,
    dataProduct,
    owner,
    reviewer,
  };
};

const deleteByName = async (path: string, fqn: string) => {
  const response = await apiContext.delete(
    `${path}/name/${encodeURIComponent(fqn)}?recursive=true&hardDelete=true`
  );

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`delete ${path}/${fqn} failed: ${await response.text()}`);
  }
};

const deleteById = async (path: string, id: string) => {
  const response = await apiContext.delete(
    `${path}/${id}?recursive=true&hardDelete=true`
  );

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`delete ${path}/${id} failed: ${await response.text()}`);
  }
};

const cleanupFixtures = async () => {
  if (!fixtures) {
    return;
  }

  await Promise.allSettled(
    fixtures.metrics.map((metric) =>
      deleteByName('/api/v1/metrics', metric.fullyQualifiedName)
    )
  );
  await Promise.allSettled([
    deleteByName(
      '/api/v1/dataProducts',
      fixtures.dataProduct.fullyQualifiedName
    ),
    deleteById('/api/v1/tags', fixtures.tag.id),
    deleteById('/api/v1/tags', fixtures.secondTag.id),
  ]);
  await deleteByName('/api/v1/domains', fixtures.domain.fullyQualifiedName);
  await deleteByName(
    '/api/v1/glossaries',
    fixtures.glossary.fullyQualifiedName
  );
};

const waitForMetricsPage = async (page: Page) => {
  const metricsResponse = waitForMetricsSearchResponse(page);
  await page.goto('/metrics');
  await metricsResponse;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('heading')).toHaveText('Metrics');
};

const filterMetrics = async (page: Page, searchText: string) => {
  await page.getByPlaceholder('Search Metrics').fill(searchText);
};

const getFirstVisibleFixtureMetricRow = async (
  page: Page
): Promise<{ metric: MetricResponse; row: Locator }> => {
  await filterMetrics(page, fixtures.prefix);

  const row = page.locator('tr').filter({ hasText: fixtures.prefix }).first();
  await expect(row).toBeVisible();

  const rowText = await row.textContent();
  const metric = fixtures.metrics.find(
    (item) =>
      rowText?.includes(item.name) ||
      (item.displayName && rowText?.includes(item.displayName))
  );

  if (!metric) {
    throw new Error(
      `Unable to resolve visible metric row from text: ${rowText}`
    );
  }

  return { metric, row };
};

const openMetricActions = async (page: Page) => {
  await page.getByTestId('metric-actions').click();
  await expect(page.locator('.metric-actions-menu')).toBeVisible();
};

const clickMetricAction = async (page: Page, actionName: string) => {
  await page
    .locator('.metric-actions-menu-item')
    .filter({ hasText: actionName })
    .click();
};

const waitForMetricBulkEditGrid = async (page: Page, metricName: string) => {
  await expect(page).toHaveURL(/\/bulk\/edit\/metric\/\*/);
  await expect(page.locator('.rdg-header-row')).toBeVisible({
    timeout: 90000,
  });
  await expect(page.getByText(metricName)).toBeVisible();
};

const editFirstDisplayNameCell = async (page: Page, value: string) => {
  const displayNameCell = page
    .locator('.rdg-row')
    .first()
    .locator('[aria-colindex="3"]');

  await displayNameCell.dblclick();
  const editor = page.locator(`${RDG_ACTIVE_CELL_SELECTOR} input`).first();
  await expect(editor).toBeVisible();
  await editor.fill(value);
  await editor.press('Enter');
  await expect(displayNameCell).toContainText(value);
};

const editFirstDisplayNameCellAndBlur = async (page: Page, value: string) => {
  const firstRow = page.locator('.rdg-row').first();
  const displayNameCell = firstRow.locator('[aria-colindex="3"]');

  await displayNameCell.dblclick();
  const editor = page.locator(`${RDG_ACTIVE_CELL_SELECTOR} input`).first();
  await expect(editor).toBeVisible();
  await editor.fill(value);
  await firstRow.locator('[aria-colindex="4"]').click();
  await expect(displayNameCell).toContainText(value);
};

const getBulkEditNextButton = (page: Page) =>
  page
    .locator('.bulk-edit-add-row-actions')
    .getByRole('button', { name: 'Next' });

const scrollBulkEditGridTo = async (page: Page, left: number) => {
  await page
    .locator('.bulk-edit-grid-shell .rdg')
    .evaluate((element, scrollLeft) => {
      element.scrollLeft = scrollLeft;
    }, left);
};

const expectVisibleAfterHorizontalScroll = async (
  page: Page,
  locator: Locator
) => {
  for (const scrollLeft of [0, 400, 800, 1200, 1600, 2000, 2400]) {
    await scrollBulkEditGridTo(page, scrollLeft);

    if (await locator.isVisible().catch(() => false)) {
      return;
    }
  }

  await expect(locator).toBeVisible();
};

const waitForMetricImportResponse = (page: Page, dryRun: boolean) =>
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/metrics/name/') &&
      response.url().includes('/importAsync') &&
      response.url().includes(`dryRun=${String(dryRun)}`) &&
      response.request().method() === 'PUT'
  );

const expectMetricImportStatus = async (
  page: Page,
  status: { processed: string; passed: string; failed: string }
) => {
  await expect(page.getByTestId('processed-row')).toContainText(
    status.processed
  );
  await expect(page.getByTestId('passed-row')).toContainText(status.passed);
  await expect(page.getByTestId('failed-row')).toContainText(status.failed);
  await page.locator('.rdg-header-row').waitFor({ state: 'visible' });
};

const routePagedMetricBulkHydration = async (page: Page) => {
  let pageRequestCount = 0;
  const pagedMetricName = `${fixtures.prefix}_paged_only_metric`;

  await page.route('**/api/v1/metrics?**', async (route) => {
    const url = new URL(route.request().url());

    if (url.searchParams.get('fields') !== '*') {
      await route.continue();

      return;
    }

    pageRequestCount += 1;

    if (pageRequestCount === 1) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          data: [
            {
              id: `${fixtures.prefix}_paged_skip`,
              name: `${fixtures.prefix}_paged_skip`,
              fullyQualifiedName: `${fixtures.prefix}_paged_skip`,
              displayName: 'Skip first page',
              description: 'First page does not match the active filter',
              metricType: 'COUNT',
              unitOfMeasurement: 'COUNT',
              granularity: 'DAY',
              metricExpression: {
                language: 'SQL',
                code: 'COUNT(*)',
              },
            },
          ],
          paging: {
            after: 'second-page',
            total: 2,
          },
        },
      });

      return;
    }

    expect(url.searchParams.get('after')).toBe('second-page');
    await route.fulfill({
      contentType: 'application/json',
      json: {
        data: [
          {
            id: `${fixtures.prefix}_paged_match`,
            name: pagedMetricName,
            fullyQualifiedName: pagedMetricName,
            displayName: 'Paged only metric',
            description: 'Second page matches the active listing filter',
            metricType: 'SUM',
            unitOfMeasurement: 'DOLLARS',
            granularity: 'MONTH',
            metricExpression: {
              language: 'SQL',
              code: 'SUM(amount)',
            },
          },
        ],
        paging: {
          total: 2,
        },
      },
    });
  });

  return {
    getPageRequestCount: () => pageRequestCount,
    pagedMetricName,
  };
};

const uploadMetricCsvAndWaitForPreview = async (
  page: Page,
  csvPath: string
) => {
  const nextPreviewButton = page.getByRole('button', {
    name: /Next:\s*Preview/i,
  });
  const fileInput = page.locator('.file-dragger-wrapper input[type="file"]');

  await expect(fileInput).toBeAttached();
  await fileInput.setInputFiles(csvPath);
  await expect(nextPreviewButton).toBeEnabled();

  const previewResponse = waitForMetricImportResponse(page, true);
  await nextPreviewButton.click();
  await previewResponse;
  await expect(page.locator('.rdg-header-row')).toBeVisible({
    timeout: 90000,
  });
};

const createMetricCsvFile = (metricName: string) => {
  const csv = createCsv([
    [
      metricName,
      `${metricName} display`,
      'Metric imported from Playwright CSV',
      'SUM',
      'DOLLARS',
      '',
      'DAY',
      'SQL',
      'SUM(order_total)',
      fixtures.metrics[0].fullyQualifiedName,
      fixtures.tag.fullyQualifiedName,
      fixtures.nestedGlossaryTerm.fullyQualifiedName,
      'Tier.Tier2',
      `user:${fixtures.owner.name}`,
      `team:${fixtures.reviewer.name}`,
      fixtures.domain.fullyQualifiedName,
      fixtures.dataProduct.fullyQualifiedName,
      'Approved',
      `${metricCustomPropertyName}:imported custom value`,
    ],
  ]);
  const csvPath = test.info().outputPath(`${metricName}.csv`);
  fs.writeFileSync(csvPath, csv);

  return csvPath;
};

const createInvalidMetricCsvFile = (fileName: string) => {
  const csv = createCsv([
    [
      '',
      'Missing name display',
      'Missing required name should fail validation',
      'SUM',
      'DOLLARS',
      '',
      'DAY',
      'SQL',
      'SUM(order_total)',
      '',
      fixtures.tag.fullyQualifiedName,
      fixtures.nestedGlossaryTerm.fullyQualifiedName,
      'Tier.Tier2',
      `user:${fixtures.owner.name}`,
      `team:${fixtures.reviewer.name}`,
      fixtures.domain.fullyQualifiedName,
      fixtures.dataProduct.fullyQualifiedName,
      '',
      '',
    ],
    [
      `${fixtures.prefix}_invalid_refs`,
      'Invalid references display',
      'Invalid references should fail validation',
      'SUM',
      'DOLLARS',
      '',
      'DAY',
      'SQL',
      'SUM(order_total)',
      'missing_metric_reference',
      'PII.DoesNotExist',
      'MissingGlossary.Term',
      'Tier.NotReal',
      'user:missing_user',
      'team:missing_team',
      'missing_domain',
      'missing_data_product',
      '',
      `${metricCustomPropertyName}:invalid refs`,
    ],
  ]);
  const csvPath = test.info().outputPath(`${fileName}.csv`);
  fs.writeFileSync(csvPath, csv);

  return csvPath;
};

const expectImportedMetricComplexFields = async (metricName: string) => {
  const importedMetric = await parseResponse<MetricResponse>(
    await apiContext.get(
      `/api/v1/metrics/name/${encodeURIComponent(
        metricName
      )}?fields=owners,reviewers,tags,domains,dataProducts,relatedMetrics,extension&include=all`
    ),
    'fetch imported metric'
  );

  expect(importedMetric.name).toBe(metricName);
  expect(importedMetric.metricType).toBe('SUM');
  expect(importedMetric.unitOfMeasurement).toBe('DOLLARS');
  expect(importedMetric.granularity).toBe('DAY');
  expect(importedMetric.metricExpression).toEqual({
    language: 'SQL',
    code: 'SUM(order_total)',
  });
  expect(importedMetric.relatedMetrics?.map((metric) => metric.name)).toContain(
    fixtures.metrics[0].name
  );
  expect(importedMetric.tags).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        tagFQN: fixtures.tag.fullyQualifiedName,
        source: 'Classification',
      }),
      expect.objectContaining({
        tagFQN: fixtures.nestedGlossaryTerm.fullyQualifiedName,
        source: 'Glossary',
      }),
      expect.objectContaining({
        tagFQN: 'Tier.Tier2',
        source: 'Classification',
      }),
    ])
  );
  expect(importedMetric.owners?.map((owner) => owner.name)).toContain(
    fixtures.owner.name
  );
  expect(importedMetric.reviewers?.map((reviewer) => reviewer.name)).toContain(
    fixtures.reviewer.name
  );
  expect(
    importedMetric.domains?.map((domain) => domain.fullyQualifiedName)
  ).toContain(fixtures.domain.fullyQualifiedName);
  expect(
    importedMetric.dataProducts?.map(
      (dataProduct) => dataProduct.fullyQualifiedName
    )
  ).toContain(fixtures.dataProduct.fullyQualifiedName);
  expect(importedMetric.extension).toMatchObject({
    [metricCustomPropertyName]: 'imported custom value',
  });
};

test.describe.configure({ mode: 'serial' });

test.describe('Metrics bulk import, export, and edit', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    const adminContext = await createAdminApiContext();
    apiContext = adminContext.apiContext;
    disposeApiContext = adminContext.afterAction;
    metricCustomPropertyName = `metric_cp_${getNameSuffix()}`;
    await createMetricStringCustomProperty(metricCustomPropertyName);
    fixtures = await createFixtures(metricCustomPropertyName);

    viewOnlyUser = new UserClass();
    viewOnlyPolicy = new PolicyClass();
    viewOnlyRole = new RolesClass();
    await viewOnlyUser.create(apiContext, false);
    await viewOnlyPolicy.create(apiContext, VIEW_ONLY_RULE);
    await viewOnlyRole.create(apiContext, [viewOnlyPolicy.responseData.name]);
    await viewOnlyUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/0',
          value: {
            id: viewOnlyRole.responseData.id,
            type: 'role',
            name: viewOnlyRole.responseData.name,
          },
        },
      ],
    });

    metricEditorUser = new UserClass();
    metricEditorPolicy = new PolicyClass();
    metricEditorRole = new RolesClass();
    await metricEditorUser.create(apiContext, false);
    await metricEditorPolicy.create(apiContext, METRIC_EDITOR_RULES);
    await metricEditorRole.create(apiContext, [
      metricEditorPolicy.responseData.name,
    ]);
    await metricEditorUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/0',
          value: {
            id: metricEditorRole.responseData.id,
            type: 'role',
            name: metricEditorRole.responseData.name,
          },
        },
      ],
    });
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await Promise.allSettled([
      viewOnlyUser?.delete(apiContext),
      viewOnlyRole?.delete(apiContext),
      viewOnlyPolicy?.delete(apiContext),
      metricEditorUser?.delete(apiContext),
      metricEditorRole?.delete(apiContext),
      metricEditorPolicy?.delete(apiContext),
    ]);
    await cleanupFixtures();
    await cleanupMetricCustomProperty();
    await disposeApiContext?.();
  });

  test('Admin starts exactly one async export job from the metrics listing', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, fixtures.prefix);
    await openMetricActions(page);

    let exportRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/metrics/name/*/exportAsync')) {
        exportRequestCount += 1;
      }
    });

    const exportResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/metrics/name/*/exportAsync') &&
        response.request().method() === 'GET'
    );

    await clickMetricAction(page, 'Export');
    const response = await exportResponse;
    expect(response.ok()).toBeTruthy();
    await expect.poll(() => exportRequestCount).toBe(1);
    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible({
      timeout: 30000,
    });
    await page.locator('.csv-jobs-tray-launcher').click();
    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible();
    await expect(page.locator('.csv-jobs-tray-item')).toHaveCount(1);
    await expect(
      page.getByText(/Exporting Metrics|Exported Metrics/)
    ).toBeVisible();
  });

  test('Admin imports a metric CSV through preview and async apply', async ({
    page,
  }) => {
    test.slow();
    const importedMetricName = `${fixtures.prefix}_imported`;
    fixtures.metrics.push({
      id: '',
      name: importedMetricName,
      fullyQualifiedName: importedMetricName,
    });

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await openMetricActions(page);
    await clickMetricAction(page, 'Import');
    await expect(page).toHaveURL(/\/bulk\/import\/metric\/\*/);

    const csvPath = createMetricCsvFile(importedMetricName);
    await uploadMetricCsvAndWaitForPreview(page, csvPath);
    await expect(
      page.getByRole('gridcell', { exact: true, name: importedMetricName })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Start Import/i })
    ).toBeVisible();

    const applyResponse = waitForMetricImportResponse(page, false);
    await page.getByRole('button', { name: /Start Import/i }).click();
    await applyResponse;
    await expectMetricImportStatus(page, {
      processed: '1',
      passed: '1',
      failed: '0',
    });

    await expectImportedMetricComplexFields(importedMetricName);
  });

  test('Admin sees metric CSV validation failures for missing names and invalid references', async ({
    page,
  }) => {
    test.slow();
    const invalidCsvPath = createInvalidMetricCsvFile(
      `${fixtures.prefix}_invalid_import`
    );

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await openMetricActions(page);
    await clickMetricAction(page, 'Import');
    await expect(page).toHaveURL(/\/bulk\/import\/metric\/\*/);

    await uploadMetricCsvAndWaitForPreview(page, invalidCsvPath);
    await expectMetricImportStatus(page, {
      processed: '2',
      passed: '0',
      failed: '2',
    });
    await expect(page.getByText('Missing name display')).toBeVisible();
    await expect(page.getByText('Invalid references display')).toBeVisible();
  });

  test('Admin imports a CSV update for an existing metric', async ({
    page,
  }) => {
    test.slow();
    const existingMetricName = fixtures.metrics[1].name;
    const updatedDisplayName = `${fixtures.prefix} Import Updated`;
    const csv = createCsv([
      [
        existingMetricName,
        updatedDisplayName,
        'Metric updated from Playwright CSV',
        'COUNT',
        'COUNT',
        '',
        'MONTH',
        'SQL',
        'COUNT(order_id)',
        fixtures.metrics[0].fullyQualifiedName,
        fixtures.secondTag.fullyQualifiedName,
        fixtures.nestedGlossaryTerm.fullyQualifiedName,
        'Tier.Tier3',
        `user:${fixtures.owner.name}`,
        `team:${fixtures.reviewer.name}`,
        fixtures.domain.fullyQualifiedName,
        fixtures.dataProduct.fullyQualifiedName,
        'Approved',
        `${metricCustomPropertyName}:updated custom value`,
      ],
    ]);
    const csvPath = test.info().outputPath(`${existingMetricName}-update.csv`);
    fs.writeFileSync(csvPath, csv);

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await openMetricActions(page);
    await clickMetricAction(page, 'Import');
    await expect(page).toHaveURL(/\/bulk\/import\/metric\/\*/);

    await uploadMetricCsvAndWaitForPreview(page, csvPath);
    await expect(page.getByText(updatedDisplayName)).toBeVisible();

    const applyResponse = waitForMetricImportResponse(page, false);
    await page.getByRole('button', { name: /Start Import/i }).click();
    const response = await applyResponse;
    expect(response.ok()).toBeTruthy();
    await expectMetricImportStatus(page, {
      processed: '1',
      passed: '1',
      failed: '0',
    });

    const updatedMetric = await parseResponse<MetricResponse>(
      await apiContext.get(
        `/api/v1/metrics/name/${existingMetricName}?fields=extension&include=all`
      ),
      'fetch CSV-updated metric'
    );
    expect(updatedMetric.displayName).toBe(updatedDisplayName);
    expect(updatedMetric.extension).toMatchObject({
      [metricCustomPropertyName]: 'updated custom value',
    });
  });

  test('Admin bulk edits filtered metrics from the listing API without export jobs', async ({
    page,
  }) => {
    test.slow();
    const targetMetricName = fixtures.metrics[METRIC_FIXTURE_COUNT - 1].name;
    const updatedDisplayName = `${fixtures.prefix} Updated Display`;
    let exportRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/exportAsync')) {
        exportRequestCount += 1;
      }
    });

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetricName);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetricName);

    await expect.poll(() => exportRequestCount).toBe(0);

    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeDisabled();
    await editFirstDisplayNameCell(page, updatedDisplayName);
    await expect(nextButton).toBeEnabled();

    const validateResponse = waitForMetricImportResponse(page, true);
    await nextButton.click();
    await validateResponse;
    await expectMetricImportStatus(page, {
      processed: '1',
      passed: '1',
      failed: '0',
    });

    const updateResponse = waitForMetricImportResponse(page, false);
    await page.getByRole('button', { name: 'Update' }).click();
    const response = await updateResponse;
    expect(response.ok()).toBeTruthy();
    await page.waitForURL(/\/metrics/, { timeout: 90000 });

    const updatedMetric = await parseResponse<MetricResponse>(
      await apiContext.get(`/api/v1/metrics/name/${targetMetricName}`),
      'fetch updated metric'
    );
    expect(updatedMetric.displayName).toBe(updatedDisplayName);
  });

  test('Admin bulk edit keeps text edits on blur and can revert to no changes', async ({
    page,
  }) => {
    const targetMetricName = fixtures.metrics[2].name;
    const originalDisplayName = fixtures.metrics[2].displayName ?? '';
    const updatedDisplayName = `${fixtures.prefix} Blur Saved`;

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetricName);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetricName);

    const nextButton = getBulkEditNextButton(page);
    await expect(nextButton).toBeDisabled();
    await editFirstDisplayNameCellAndBlur(page, updatedDisplayName);
    await expect(nextButton).toBeEnabled();

    await page.getByRole('button', { name: 'Revert Changes' }).click();
    await expect(nextButton).toBeDisabled();
    await expect(
      page.locator('.rdg-row').first().locator('[aria-colindex="3"]')
    ).toContainText(originalDisplayName);
  });

  test('Admin bulk edit hydrates filtered metrics across cursor pages', async ({
    page,
  }) => {
    const { getPageRequestCount, pagedMetricName } =
      await routePagedMetricBulkHydration(page);
    let exportRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/exportAsync')) {
        exportRequestCount += 1;
      }
    });

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, 'paged_only_metric');
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, pagedMetricName);

    await expect.poll(getPageRequestCount).toBe(2);
    await expect.poll(() => exportRequestCount).toBe(0);
    await expect(
      page.getByText(`${fixtures.prefix}_paged_skip`)
    ).not.toBeVisible();
  });

  test('Admin bulk edit renders complex fields from listing hydration', async ({
    page,
  }) => {
    const targetMetric = fixtures.metrics[0];

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetric.name);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetric.name);

    await expect(page.getByText(targetMetric.displayName ?? '')).toBeVisible();
    await expectVisibleAfterHorizontalScroll(
      page,
      page.getByText(/SELECT SUM\(amount\)/)
    );

    await expectVisibleAfterHorizontalScroll(
      page,
      page.getByText(fixtures.tag.fullyQualifiedName)
    );
    await expectVisibleAfterHorizontalScroll(
      page,
      page.locator(
        `[title="${fixtures.nestedGlossaryTerm.fullyQualifiedName}"]`
      )
    );
    await expectVisibleAfterHorizontalScroll(page, page.getByText('Tier2'));
    await expectVisibleAfterHorizontalScroll(
      page,
      page.getByText(fixtures.owner.name)
    );
    await expectVisibleAfterHorizontalScroll(
      page,
      page.getByText(fixtures.reviewer.name)
    );
    await expectVisibleAfterHorizontalScroll(
      page,
      page.getByText(fixtures.domain.fullyQualifiedName)
    );
    await expectVisibleAfterHorizontalScroll(
      page,
      page.getByText(fixtures.dataProduct.fullyQualifiedName)
    );
    await expectVisibleAfterHorizontalScroll(
      page,
      page.getByText(`${fixtures.prefix} custom property 0`)
    );
  });

  test('Admin bulk edits only selected metric rows', async ({ page }) => {
    let exportRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/exportAsync')) {
        exportRequestCount += 1;
      }
    });

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    const { metric: selectedMetric, row } =
      await getFirstVisibleFixtureMetricRow(page);
    const unselectedMetric =
      fixtures.metrics.find((metric) => metric.name !== selectedMetric.name) ??
      fixtures.metrics[0];

    // eslint-disable-next-line playwright/no-force-option -- styled checkbox control intercepts the native input.
    await row.getByRole('checkbox').check({ force: true });
    await expect(page.locator('.metric-list-selection-count')).toHaveText('1');

    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, selectedMetric.name);

    await expect.poll(() => exportRequestCount).toBe(0);
    await expect(page.getByText(selectedMetric.name)).toBeVisible();
    await expect(page.getByText(unselectedMetric.name)).not.toBeVisible();
  });

  test('Cancel from metric bulk edit returns to the metrics listing', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    const { metric } = await getFirstVisibleFixtureMetricRow(page);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, metric.name);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/metrics/);
  });

  test('Custom metric editor role can import export and bulk edit metrics', async ({
    browser,
  }) => {
    const metricEditorPage = await browser.newPage();
    await metricEditorUser.login(metricEditorPage);

    try {
      await redirectToHomePage(metricEditorPage);
      await waitForMetricsPage(metricEditorPage);
      await expect(metricEditorPage.getByTestId('create-metric')).toBeVisible();
      await expect(
        metricEditorPage.getByTestId('bulk-edit-metric')
      ).toBeVisible();
      await openMetricActions(metricEditorPage);
      await expect(
        metricEditorPage
          .locator('.metric-actions-menu-item')
          .filter({ hasText: 'Export' })
      ).toBeVisible();
      await expect(
        metricEditorPage
          .locator('.metric-actions-menu-item')
          .filter({ hasText: 'Import' })
      ).toBeVisible();
      await metricEditorPage.keyboard.press('Escape');

      await verifyPageAccess(metricEditorPage, '/bulk/import/metric/*', true);
      await verifyPageAccess(metricEditorPage, '/bulk/edit/metric/*', true);
    } finally {
      await metricEditorPage.close();
    }
  });

  test('Restricted roles cannot access metric import or bulk edit', async ({
    browser,
    dataConsumerPage,
    dataStewardPage,
    viewOnlyPage,
  }) => {
    const customViewOnlyPage = await browser.newPage();
    await viewOnlyUser.login(customViewOnlyPage);

    try {
      for (const restrictedPage of [
        dataConsumerPage,
        dataStewardPage,
        viewOnlyPage,
        customViewOnlyPage,
      ]) {
        await redirectToHomePage(restrictedPage);
        await waitForMetricsPage(restrictedPage);
        await expect(
          restrictedPage.getByTestId('create-metric')
        ).not.toBeVisible();
        await expect(
          restrictedPage.getByTestId('bulk-edit-metric')
        ).not.toBeVisible();
        await expect(
          restrictedPage.getByTestId('metric-actions')
        ).not.toBeVisible();
        await verifyPageAccess(restrictedPage, '/bulk/import/metric/*', false);
        await verifyPageAccess(restrictedPage, '/bulk/edit/metric/*', false);
      }
    } finally {
      await customViewOnlyPage.close();
    }
  });

  test('Bulk edit grid shows NO_CHANGE badge on unmodified rows', async ({
    page,
  }) => {
    const targetMetric = fixtures.metrics[3];

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetric.name);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetric.name);

    await expect(
      page.locator('.bulk-edit-operation-badge-no_change').first()
    ).toBeVisible();
    await expect(page.getByTestId('bulk-edit-operation-summary')).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-no_change')
    ).toContainText('1');
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('0');
  });

  test('Bulk edit grid shows UPDATE badge and increments summary after editing a cell', async ({
    page,
  }) => {
    const targetMetric = fixtures.metrics[4];
    const updatedDisplayName = `${fixtures.prefix} Badge Update Test`;

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetric.name);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetric.name);

    await expect(
      page.locator('.bulk-edit-operation-badge-no_change').first()
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('0');

    await editFirstDisplayNameCell(page, updatedDisplayName);

    await expect(
      page.locator('.bulk-edit-operation-badge-update').first()
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-update')
    ).toContainText('1');
    await expect(
      page.locator('.bulk-edit-operation-summary-count-no_change')
    ).toContainText('0');
  });

  test('Adding a new metric row shows CREATE badge once name is filled', async ({
    page,
  }) => {
    const targetMetric = fixtures.metrics[5];
    const newMetricName = `${fixtures.prefix}_add_row_test`;

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetric.name);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetric.name);

    await page.getByTestId('bulk-edit-add-metric').click();

    await expect(page.locator('.rdg-row')).toHaveCount(2);

    const newRow = page.locator('.rdg-row').last();
    const nameCell = newRow.locator('[aria-colindex="2"]');
    await nameCell.dblclick();

    const nameEditor = page
      .locator(`${RDG_ACTIVE_CELL_SELECTOR} input`)
      .first();
    await expect(nameEditor).toBeVisible();
    await nameEditor.fill(newMetricName);
    await nameEditor.press('Enter');

    await expect(
      page.locator('.bulk-edit-operation-badge-create')
    ).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-summary-count-create')
    ).toContainText('1');
  });

  test('New metric row without a name shows error pill and SKIP badge', async ({
    page,
  }) => {
    const targetMetric = fixtures.metrics[6];

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetric.name);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetric.name);

    await page.getByTestId('bulk-edit-add-metric').click();

    await expect(page.locator('.bulk-edit-error-pill')).toBeVisible();
    await expect(
      page.locator('.bulk-edit-operation-badge-skip').last()
    ).toBeVisible();
  });

  test('Removing a newly added metric row restores the grid state', async ({
    page,
  }) => {
    const targetMetric = fixtures.metrics[7];

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, targetMetric.name);
    await page.getByTestId('bulk-edit-metric').click();
    await waitForMetricBulkEditGrid(page, targetMetric.name);

    const rowsBefore = await page.locator('.rdg-row').count();

    await page.getByTestId('bulk-edit-add-metric').click();
    await expect(page.locator('.rdg-row')).toHaveCount(rowsBefore + 1);

    await page.getByTestId('bulk-edit-remove-row').click();
    await expect(page.locator('.rdg-row')).toHaveCount(rowsBefore);
    await expect(page.locator('.bulk-edit-error-pill')).not.toBeVisible();
  });

  test('Bulk edit grid search filters rows to match the search term', async ({
    page,
  }) => {
    const firstMetric = fixtures.metrics[0];
    const lastMetric = fixtures.metrics[METRIC_FIXTURE_COUNT - 2];

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, fixtures.prefix);
    await page.getByTestId('bulk-edit-metric').click();
    await expect(page).toHaveURL(/\/bulk\/edit\/metric\/\*/);
    await expect(page.locator('.rdg-header-row')).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator('.rdg-row').first()).toBeVisible();

    const searchInput = page.getByTestId('bulk-edit-search').locator('input');
    await searchInput.fill(firstMetric.name);

    await expect(page.getByText(firstMetric.name)).toBeVisible();
    await expect(page.getByText(lastMetric.name)).not.toBeVisible();
  });

  test('Clearing the bulk edit search box restores all rows', async ({
    page,
  }) => {
    const firstMetric = fixtures.metrics[0];
    const lastMetric = fixtures.metrics[METRIC_FIXTURE_COUNT - 2];

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, fixtures.prefix);
    await page.getByTestId('bulk-edit-metric').click();
    await expect(page).toHaveURL(/\/bulk\/edit\/metric\/\*/);
    await expect(page.locator('.rdg-header-row')).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.locator('.rdg-row').first()).toBeVisible();

    const searchInput = page.getByTestId('bulk-edit-search').locator('input');
    await searchInput.fill(firstMetric.name);
    await expect(page.getByText(lastMetric.name)).not.toBeVisible();

    await searchInput.fill('');
    await expect(page.getByText(lastMetric.name)).toBeVisible();
  });

  test('Admin can cancel a metric import mid-flight and cancel API is called', async ({
    page,
  }) => {
    test.slow();

    const cancelMetricName = `${fixtures.prefix}_cancel_flight`;
    const csvPath = createMetricCsvFile(cancelMetricName);

    // The Cancel Import button is enabled only after the server sends a WebSocket
    // STARTED event.  We must intercept the socket BEFORE the first navigation so
    // the connection is routed through Playwright.  We use a flag to let the
    // dry-run (dryRun=true) COMPLETED event pass — it renders the preview grid —
    // while blocking the actual import COMPLETED to keep the button clickable.
    let blockImportCompletion = false;

    await page.routeWebSocket(/\/api\/v1\/push\/feed/, (ws) => {
      const server = ws.connectToServer();

      server.onMessage((msg) => {
        if (
          blockImportCompletion &&
          typeof msg === 'string' &&
          msg.includes('csvImportChannel') &&
          (msg.includes('COMPLETED') || msg.includes('FAILED'))
        ) {
          return; // Drop — keeps the Cancel Import button enabled
        }
        ws.send(msg);
      });

      ws.onMessage((msg) => server.send(msg));
    });

    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await openMetricActions(page);
    await clickMetricAction(page, 'Import');
    await expect(page).toHaveURL(/\/bulk\/import\/metric\/\*/);

    // Dry-run preview — let COMPLETED through (blockImportCompletion is false)
    await uploadMetricCsvAndWaitForPreview(page, csvPath);
    await expect(
      page.getByRole('button', { name: /Start Import/i })
    ).toBeVisible();

    // From this point block the actual import COMPLETED so the cancel button
    // stays enabled after STARTED fires.
    blockImportCompletion = true;

    let cancelApiCalled = false;
    await page.route('**/api/v1/csvAsyncJobs/*/cancel', async (route) => {
      cancelApiCalled = true;
      await route.fulfill({
        contentType: 'application/json',
        json: { status: 'CANCELLING' },
      });
    });

    await page.getByRole('button', { name: /Start Import/i }).click();

    // Wait for STARTED WebSocket event → button becomes enabled
    const cancelBtn = page.getByRole('button', { name: /Cancel Import/i });
    await expect(cancelBtn).toBeEnabled({ timeout: 30_000 });
    await cancelBtn.click();

    await expect.poll(() => cancelApiCalled, { timeout: 15_000 }).toBe(true);
  });

  test('MetricListPage header checkbox selects all visible metrics', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, fixtures.prefix);

    await expect(page.getByTestId('metric-name').first()).toBeVisible();

    // The table is React Aria — click the visible <label slot="selection"> in
    // the header to trigger select-all (no force needed; the label is visible).
    await page.locator('thead label[slot="selection"]').click();

    await expect(page.locator('.metric-list-selection-bar')).toBeVisible();
    await expect(page.locator('.metric-list-selection-count')).not.toHaveText(
      '0'
    );
  });

  test('MetricListPage unchecking header checkbox clears the selection bar', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForMetricsPage(page);
    await filterMetrics(page, fixtures.prefix);

    await expect(page.getByTestId('metric-name').first()).toBeVisible();

    await page.locator('thead label[slot="selection"]').click();
    await expect(page.locator('.metric-list-selection-bar')).toBeVisible();

    await page.locator('thead label[slot="selection"]').click();
    await expect(page.locator('.metric-list-selection-bar')).not.toBeVisible();
  });
});
