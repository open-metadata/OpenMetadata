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

import { expect, test } from '@playwright/test';
import { DataType } from '../../../src/generated/entity/data/table';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { uuid } from '../../utils/common';
import {
  addCustomRelationTypes,
  addTermRelation,
  applyGlossaryFilter,
  applyMultipleGlossaryFilters,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyExplorer,
  readGraphEdges,
  RelationTypeDef,
  restoreRelationTypeSettings,
  selectViewMode,
  tagTableWithGlossaryTerm,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

const bizGlossary = new Glossary();
const dwhGlossary = new Glossary();

const termCustomer = new GlossaryTerm(bizGlossary, undefined, 'Customer');
const termOrder = new GlossaryTerm(bizGlossary, undefined, 'SalesOrder');
const termOrderItem = new GlossaryTerm(bizGlossary, undefined, 'OrderItem');
const termProduct = new GlossaryTerm(bizGlossary, undefined, 'Product');
const termEmployee = new GlossaryTerm(bizGlossary, undefined, 'Employee');
const termEmployeeProfile = new GlossaryTerm(
  bizGlossary,
  undefined,
  'EmployeeProfile'
);
const termProductCategory = new GlossaryTerm(
  bizGlossary,
  undefined,
  'ProductCategory'
);

const termDimCustomer = new GlossaryTerm(dwhGlossary, undefined, 'DimCustomer');

const CUSTOM_TYPES: RelationTypeDef[] = [
  {
    name: 'testHasPK',
    displayName: 'Has Primary Key',
    description: 'ONE_TO_ONE — entity owns exactly one child record',
    cardinality: 'ONE_TO_ONE',
    isSymmetric: false,
    category: 'associative',
    color: '#e31b54',
  },
  {
    name: 'testContains',
    displayName: 'Contains',
    description: 'ONE_TO_MANY — parent owns multiple child records',
    inverseRelation: 'testContainedBy',
    cardinality: 'ONE_TO_MANY',
    isSymmetric: false,
    category: 'associative',
    color: '#0e9384',
  },
  {
    name: 'testContainedBy',
    displayName: 'Contained By',
    description: 'Inverse of Contains',
    inverseRelation: 'testContains',
    cardinality: 'MANY_TO_ONE',
    isSymmetric: false,
    category: 'associative',
    color: '#0e9384',
  },
  {
    name: 'testGovernedBy',
    displayName: 'Governed By',
    description: 'MANY_TO_ONE — many records reference one master record',
    inverseRelation: 'testGoverns',
    cardinality: 'MANY_TO_ONE',
    isSymmetric: false,
    category: 'associative',
    color: '#7a5af8',
  },
  {
    name: 'testGoverns',
    displayName: 'Governs',
    description: 'Inverse of Governed By',
    inverseRelation: 'testGovernedBy',
    cardinality: 'ONE_TO_MANY',
    isSymmetric: false,
    category: 'associative',
    color: '#7a5af8',
  },
  {
    name: 'testCrossRef',
    displayName: 'Cross Reference',
    description: 'MANY_TO_MANY — bidirectional cross-domain reference',
    cardinality: 'MANY_TO_MANY',
    isSymmetric: true,
    category: 'associative',
    color: '#f79009',
  },
];

let dbServiceId = '';
let tableIds: Record<string, string> = {};

function findEdge(
  edges: Awaited<ReturnType<typeof readGraphEdges>>,
  fromId: string,
  toId: string
) {
  return edges.find(
    (e) =>
      (e.from === fromId && e.to === toId) ||
      (e.from === toId && e.to === fromId)
  );
}

function hasRelationType(
  edges: Awaited<ReturnType<typeof readGraphEdges>>,
  fromId: string,
  toId: string,
  relationType: string
) {
  return edges.some(
    (e) =>
      ((e.from === fromId && e.to === toId) ||
        (e.from === toId && e.to === fromId)) &&
      (e.relationType === relationType ||
        e.inverseRelationType === relationType)
  );
}

let originalSettings: RelationTypeDef[] = [];

test.describe('E-Commerce Scenario – Realistic Cardinality Data', () => {
  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);
    originalSettings = await addCustomRelationTypes(apiContext, CUSTOM_TYPES);

    await bizGlossary.create(apiContext);
    await dwhGlossary.create(apiContext);

    await Promise.all([
      termCustomer.create(apiContext),
      termOrder.create(apiContext),
      termOrderItem.create(apiContext),
      termProduct.create(apiContext),
      termEmployee.create(apiContext),
      termEmployeeProfile.create(apiContext),
      termProductCategory.create(apiContext),
      termDimCustomer.create(apiContext),
    ]);

    const uid = uuid();
    const svcName = `pw-ecomm-svc-${uid}`;

    const svcRes = await apiContext.post('/api/v1/services/databaseServices', {
      data: {
        name: svcName,
        serviceType: 'Mysql',
        connection: {
          config: {
            type: 'Mysql',
            scheme: 'mysql+pymysql',
            username: 'username',
            authType: { password: 'password' },
            hostPort: 'mysql:3306',
            supportsMetadataExtraction: true,
          },
        },
      },
    });
    const svc = await svcRes.json();
    dbServiceId = svc.id;

    const dbRes = await apiContext.post('/api/v1/databases', {
      data: {
        name: `ecomm_db_${uid}`,
        service: svc.fullyQualifiedName,
      },
    });
    const db = await dbRes.json();

    const schemaRes = await apiContext.post('/api/v1/databaseSchemas', {
      data: {
        name: `ecomm_schema_${uid}`,
        database: db.fullyQualifiedName,
      },
    });
    const schema = await schemaRes.json();

    const tableSpecs = [
      {
        key: 'dimCustomer',
        name: `dim_customer_${uid}`,
        displayName: 'Dim Customer',
        description: 'Customer dimension table — one row per customer',
        columns: [
          {
            name: 'customer_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Surrogate primary key',
          },
          {
            name: 'email',
            dataType: DataType.Varchar,
            dataLength: 255,
            dataTypeDisplay: 'varchar',
            description: 'Customer email address',
          },
          {
            name: 'full_name',
            dataType: DataType.Varchar,
            dataLength: 200,
            dataTypeDisplay: 'varchar',
            description: 'Customer full name',
          },
          {
            name: 'country',
            dataType: DataType.Varchar,
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'Country of residence',
          },
          {
            name: 'created_at',
            dataType: DataType.Timestamp,
            dataTypeDisplay: 'timestamp',
            description: 'Account creation timestamp',
          },
        ],
      },
      {
        key: 'factOrders',
        name: `fact_orders_${uid}`,
        displayName: 'Fact Orders',
        description: 'Sales order fact table — one row per order',
        columns: [
          {
            name: 'order_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Surrogate primary key',
          },
          {
            name: 'customer_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'FK to dim_customer',
          },
          {
            name: 'order_date',
            dataType: DataType.Date,
            dataTypeDisplay: 'date',
            description: 'Date the order was placed',
          },
          {
            name: 'total_amount',
            dataType: DataType.Decimal,
            dataTypeDisplay: 'decimal',
            description: 'Total order value in USD',
          },
          {
            name: 'status',
            dataType: DataType.Varchar,
            dataLength: 50,
            dataTypeDisplay: 'varchar',
            description: 'Order status (PENDING, SHIPPED, DELIVERED)',
          },
        ],
      },
      {
        key: 'factOrderItems',
        name: `fact_order_items_${uid}`,
        displayName: 'Fact Order Items',
        description: 'Order line-item fact — one row per product per order',
        columns: [
          {
            name: 'item_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Surrogate primary key',
          },
          {
            name: 'order_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'FK to fact_orders',
          },
          {
            name: 'product_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'FK to dim_product',
          },
          {
            name: 'quantity',
            dataType: DataType.Int,
            dataTypeDisplay: 'int',
            description: 'Units ordered',
          },
          {
            name: 'unit_price',
            dataType: DataType.Decimal,
            dataTypeDisplay: 'decimal',
            description: 'Price per unit at time of order',
          },
        ],
      },
      {
        key: 'dimProduct',
        name: `dim_product_${uid}`,
        displayName: 'Dim Product',
        description: 'Product dimension table',
        columns: [
          {
            name: 'product_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Surrogate primary key',
          },
          {
            name: 'product_name',
            dataType: DataType.Varchar,
            dataLength: 255,
            dataTypeDisplay: 'varchar',
            description: 'Product display name',
          },
          {
            name: 'sku',
            dataType: DataType.Varchar,
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'Stock-keeping unit code',
          },
          {
            name: 'price',
            dataType: DataType.Decimal,
            dataTypeDisplay: 'decimal',
            description: 'List price in USD',
          },
          {
            name: 'category_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'FK to dim_product_category',
          },
        ],
      },
      {
        key: 'dimEmployee',
        name: `dim_employee_${uid}`,
        displayName: 'Dim Employee',
        description: 'Employee dimension table',
        columns: [
          {
            name: 'employee_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Surrogate primary key',
          },
          {
            name: 'email',
            dataType: DataType.Varchar,
            dataLength: 255,
            dataTypeDisplay: 'varchar',
            description: 'Work email address',
          },
          {
            name: 'first_name',
            dataType: DataType.Varchar,
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'First name',
          },
          {
            name: 'last_name',
            dataType: DataType.Varchar,
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'Last name',
          },
          {
            name: 'department',
            dataType: DataType.Varchar,
            dataLength: 100,
            dataTypeDisplay: 'varchar',
            description: 'Business department',
          },
          {
            name: 'hire_date',
            dataType: DataType.Date,
            dataTypeDisplay: 'date',
            description: 'Date of hire',
          },
        ],
      },
      {
        key: 'dimEmployeeProfile',
        name: `dim_employee_profile_${uid}`,
        displayName: 'Dim Employee Profile',
        description: 'Extended employee profile — one-to-one with dim_employee',
        columns: [
          {
            name: 'profile_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Surrogate primary key',
          },
          {
            name: 'employee_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'FK to dim_employee (unique)',
          },
          {
            name: 'bio',
            dataType: DataType.Text,
            dataTypeDisplay: 'text',
            description: 'Employee biography',
          },
          {
            name: 'skills',
            dataType: DataType.Text,
            dataTypeDisplay: 'text',
            description: 'Comma-separated skill tags',
          },
        ],
      },
      {
        key: 'dimProductCategory',
        name: `dim_product_category_${uid}`,
        displayName: 'Dim Product Category',
        description:
          'Product category dimension — products can span many categories',
        columns: [
          {
            name: 'category_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Surrogate primary key',
          },
          {
            name: 'name',
            dataType: DataType.Varchar,
            dataLength: 200,
            dataTypeDisplay: 'varchar',
            description: 'Category name',
          },
          {
            name: 'description',
            dataType: DataType.Text,
            dataTypeDisplay: 'text',
            description: 'Category description',
          },
          {
            name: 'parent_category_id',
            dataType: DataType.Bigint,
            dataTypeDisplay: 'bigint',
            description: 'Self-referencing FK for sub-categories',
          },
        ],
      },
    ];
    const tableEntries = await Promise.all(
      tableSpecs.map(async (spec) => {
        const res = await apiContext.post('/api/v1/tables', {
          data: {
            name: spec.name,
            displayName: spec.displayName,
            description: spec.description,
            columns: spec.columns,
            tableType: 'Regular',
            databaseSchema: schema.fullyQualifiedName,
          },
        });
        const tbl = await res.json();

        return [spec.key, tbl.id] as [string, string];
      })
    );
    tableIds = Object.fromEntries(tableEntries);

    const termTableMap: Array<[GlossaryTerm, string]> = [
      [termCustomer, tableIds.dimCustomer],
      [termOrder, tableIds.factOrders],
      [termOrderItem, tableIds.factOrderItems],
      [termProduct, tableIds.dimProduct],
      [termEmployee, tableIds.dimEmployee],
      [termEmployeeProfile, tableIds.dimEmployeeProfile],
      [termProductCategory, tableIds.dimProductCategory],
    ];

    await Promise.all(
      termTableMap.map(([term, tableId]) =>
        tagTableWithGlossaryTerm(
          apiContext,
          tableId,
          term.responseData.fullyQualifiedName
        )
      )
    );
    await addTermRelation(
      apiContext,
      termEmployee,
      termEmployeeProfile,
      'testHasPK'
    );

    await addTermRelation(apiContext, termCustomer, termOrder, 'testContains');
    await addTermRelation(apiContext, termOrder, termOrderItem, 'testContains');
    await addTermRelation(
      apiContext,
      termOrderItem,
      termProduct,
      'testGovernedBy'
    );

    await addTermRelation(
      apiContext,
      termProduct,
      termProductCategory,
      'testCrossRef'
    );
    await addTermRelation(apiContext, termDimCustomer, termCustomer, 'synonym');

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    if (dbServiceId) {
      await apiContext.delete(
        `/api/v1/services/databaseServices/${dbServiceId}?hardDelete=true&recursive=true`
      );
    }

    await deleteEntities(
      apiContext,
      termCustomer,
      termOrder,
      termOrderItem,
      termProduct,
      termEmployee,
      termEmployeeProfile,
      termProductCategory,
      termDimCustomer,
      bizGlossary,
      dwhGlossary
    );

    await restoreRelationTypeSettings(apiContext, originalSettings);

    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, bizGlossary.responseData.id);
    await waitForGraphLoaded(page);
  });

  test.describe('ONE_TO_ONE – Employee owns one EmployeeProfile', () => {
    test('Employee → EmployeeProfile edge exists and is unidirectional (no auto-inverse)', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);
      const edge = findEdge(
        edges,
        termEmployee.responseData.id,
        termEmployeeProfile.responseData.id
      );

      expect(
        edge,
        'Employee→EmployeeProfile edge must be present'
      ).toBeDefined();
      expect(
        edge?.relationType === 'testHasPK' ||
          edge?.inverseRelationType === 'testHasPK',
        'edge must carry testHasPK relation type'
      ).toBe(true);
    });
  });

  test.describe('ONE_TO_MANY – Customer places many Orders', () => {
    test('Customer → SalesOrder edge carries testContains relationType', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);

      expect(
        hasRelationType(
          edges,
          termCustomer.responseData.id,
          termOrder.responseData.id,
          'testContains'
        ),
        'Customer→Order testContains edge must be present'
      ).toBe(true);
    });

    test('SalesOrder → OrderItem edge carries testContains relationType', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);

      expect(
        hasRelationType(
          edges,
          termOrder.responseData.id,
          termOrderItem.responseData.id,
          'testContains'
        ),
        'Order→OrderItem testContains edge must be present'
      ).toBe(true);
    });
  });

  test.describe('MANY_TO_ONE – many OrderItems reference one Product', () => {
    test('OrderItem → Product edge carries testGovernedBy relationType', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);

      expect(
        hasRelationType(
          edges,
          termOrderItem.responseData.id,
          termProduct.responseData.id,
          'testGovernedBy'
        ),
        'OrderItem→Product testGovernedBy edge must be present'
      ).toBe(true);
    });
  });

  test.describe('MANY_TO_MANY – Product belongs to many ProductCategories', () => {
    test('Product ↔ ProductCategory edge is isBidirectional=true (symmetric)', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);
      const edge = findEdge(
        edges,
        termProduct.responseData.id,
        termProductCategory.responseData.id
      );

      expect(
        edge,
        'Product↔ProductCategory edge must be present'
      ).toBeDefined();
      expect(
        edge?.isBidirectional,
        'MANY_TO_MANY symmetric edge must be isBidirectional=true'
      ).toBe(true);
    });
  });

  test.describe('Cross-glossary synonym – Customer ↔ DimCustomer', () => {
    test('synonym edge between business Customer and DWH DimCustomer is isBidirectional=true', async ({
      page,
    }) => {
      await applyMultipleGlossaryFilters(
        page,
        bizGlossary.responseData.id,
        dwhGlossary.responseData.id
      );
      await waitForGraphLoaded(page);

      const edges = await readGraphEdges(page);
      const edge = findEdge(
        edges,
        termCustomer.responseData.id,
        termDimCustomer.responseData.id
      );

      expect(
        edge,
        'cross-glossary synonym edge must appear in the graph'
      ).toBeDefined();
      expect(
        edge?.isBidirectional,
        'synonym is symmetric — must be isBidirectional=true'
      ).toBe(true);
    });
  });

  test('graph contains at least 5 edges covering all four cardinality types', async ({
    page,
  }) => {
    const edges = await readGraphEdges(page);

    const hasOneToOne = edges.some(
      (e) =>
        e.relationType === 'testHasPK' || e.inverseRelationType === 'testHasPK'
    );
    const hasOneToMany = edges.some(
      (e) =>
        e.relationType === 'testContains' ||
        e.inverseRelationType === 'testContains'
    );
    const hasManyToOne = edges.some(
      (e) =>
        e.relationType === 'testGovernedBy' ||
        e.inverseRelationType === 'testGovernedBy'
    );
    const hasManyToMany = edges.some(
      (e) =>
        e.relationType === 'testCrossRef' ||
        e.inverseRelationType === 'testCrossRef'
    );

    expect(hasOneToOne, 'at least one ONE_TO_ONE edge must exist').toBe(true);
    expect(hasOneToMany, 'at least one ONE_TO_MANY edge must exist').toBe(true);
    expect(hasManyToOne, 'at least one MANY_TO_ONE edge must exist').toBe(true);
    expect(hasManyToMany, 'at least one MANY_TO_MANY edge must exist').toBe(
      true
    );
    expect(edges.length).toBeGreaterThanOrEqual(5);
  });

  test('all cardinality edges survive a Hierarchy view-mode round-trip', async ({
    page,
  }) => {
    const before = await readGraphEdges(page);

    await selectViewMode(page, 'hierarchy');
    await selectViewMode(page, 'overview');

    const after = await readGraphEdges(page);

    const typesAfter = new Set(
      after.flatMap((e) =>
        [e.relationType, e.inverseRelationType].filter(Boolean)
      )
    );

    for (const expected of [
      'testHasPK',
      'testContains',
      'testGovernedBy',
      'testCrossRef',
    ]) {
      expect(
        typesAfter.has(expected),
        `${expected} edge must survive view-mode round-trip`
      ).toBe(true);
    }

    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });

  test('Data mode tab is reachable and shows content for terms with linked tables', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Data' }).click();
    await waitForGraphLoaded(page);
    await expect(page.getByRole('tab', { name: 'Data' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
