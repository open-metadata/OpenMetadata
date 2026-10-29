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
import { APIRequestContext } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../src/generated/entity/data/ontologyProperty';
import {
  ConstraintType,
  Table,
} from '../../../src/generated/entity/data/table';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';

const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

test.use({ isolatedUserOptions: { isAdmin: true } });

const createConcept = async (
  api: APIRequestContext,
  ontology: Ontology,
  name: string,
  displayName: string
) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        displayName,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
      },
    }),
    `Create ${name}`
  );

const createProperty = async (
  api: APIRequestContext,
  ontology: Ontology,
  property: Partial<OntologyProperty>
) =>
  okJson<OntologyProperty>(
    await api.post('/api/v1/ontologyProperties', {
      data: {
        ...property,
        ontology: ontology.fullyQualifiedName,
        iri: `${ontology.namespace}${property.name}`,
      },
    }),
    `Create ${property.name}`
  );

const createTable = async (
  api: APIRequestContext,
  databaseSchema: string,
  name: string,
  columns: string[],
  tableConstraints: Table['tableConstraints'] = []
) =>
  okJson<Table>(
    await api.post('/api/v1/tables', {
      data: {
        name,
        databaseSchema,
        columns: columns.map((column) => ({
          name: column,
          dataType: 'STRING',
        })),
        tableConstraints,
      },
    }),
    `Create ${name}`
  );

const bindColumns = async (
  api: APIRequestContext,
  concept: OntologyConcept,
  table: Table,
  columns: Array<{ property: OntologyProperty; column: string }>
) =>
  okJson(
    await api.put(`/api/v1/ontologyConcepts/${concept.id}/bindings`, {
      data: {
        expectedRevision: 0,
        asset: {
          assetType: 'table',
          assetId: table.id,
          columns: columns.map(({ property, column }) => ({
            propertyId: property.id,
            columnPath: [column],
          })),
        },
      },
    }),
    `Bind ${table.name} to ${concept.name}`
  );

test.describe(
  'Native ontology Live data',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('shows the generated SQL, one search-around hop and the not stored badge', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_live_data_${uuid()}`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
        }),
        'Create Live data ontology'
      );
      const anchor = new TableClass();
      const created: Table[] = [];
      try {
        await anchor.create(api);
        const schema = anchor.schemaResponseData.fullyQualifiedName ?? '';
        const transfer = await createConcept(
          api,
          ontology,
          'FundsTransfer',
          'Funds Transfer'
        );
        const customer = await createConcept(
          api,
          ontology,
          'Customer',
          'Customer'
        );
        const dataProperty = (propertyName: string, domain: OntologyConcept) =>
          createProperty(api, ontology, {
            name: propertyName,
            kind: Kind.Data,
            domain: [domain.iri],
            range: [XSD_STRING],
          });
        const transferId = await dataProperty('transferId', transfer);
        const amountUsd = await dataProperty('amountUsd', transfer);
        const customerName = await dataProperty('customerName', customer);
        const partOf = await createProperty(api, ontology, {
          name: 'partOf',
          displayName: 'part of',
          kind: Kind.Object,
          domain: [transfer.iri],
          range: [customer.iri],
        });
        const customers = await createTable(api, schema, 'customers', [
          'customer_id',
          'customer_name',
        ]);
        created.push(customers);
        const transfers = await createTable(
          api,
          schema,
          'transfers',
          ['transfer_id', 'amount_usd', 'customer_id'],
          [
            {
              constraintType: ConstraintType.ForeignKey,
              columns: ['customer_id'],
              referredColumns: [`${customers.fullyQualifiedName}.customer_id`],
            },
          ]
        );
        created.push(transfers);
        await bindColumns(api, transfer, transfers, [
          { property: transferId, column: 'transfer_id' },
          { property: amountUsd, column: 'amount_usd' },
        ]);
        await bindColumns(api, customer, customers, [
          { property: customerName, column: 'customer_name' },
        ]);

        await page.goto(
          `/governance/ontology?ontology=${ontology.id}&concept=${transfer.id}`
        );
        const liveData = page
          .getByTestId('ontology-concept-inspector')
          .getByTestId('ontology-concept-live-data');
        const sql = liveData.getByTestId('ontology-live-data-sql');

        await test.step('Show the bound columns, the badge and no preview in OSS', async () => {
          await expect(sql).toContainText('SELECT transfer_id, amount_usd');
          await expect(sql).toContainText('transfers');
          await expect(sql).toContainText('LIMIT 50');
          await expect(
            liveData.getByTestId('ontology-live-data-not-stored')
          ).toBeVisible();
          await expect(
            liveData.getByRole('button', { name: /preview|sql studio/i })
          ).toHaveCount(0);
        });

        await test.step('Add one search-around hop through the foreign key', async () => {
          const generated = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/v1/ontologyConcepts/${transfer.id}/query` &&
              response.request().postData()?.includes(partOf.id) === true
          );
          await liveData
            .getByTestId('ontology-live-data-search-around')
            .click();
          await liveData
            .getByTestId(
              `ontology-live-data-hop-option-${partOf.id}:${customer.id}`
            )
            .click();
          expect((await generated).ok()).toBe(true);
          await expect(sql).toContainText('SELECT t1.customer_name');
          await expect(sql).toContainText(
            't0.customer_id = t1.customer_id -- part of'
          );
          await expect(
            liveData.getByTestId('ontology-live-data-hops')
          ).toContainText('part of · Customer');
        });
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
        );
        for (const table of created) {
          await deleteFixtureEntity(
            api,
            `/api/v1/tables/${table.id}?hardDelete=true`
          );
        }
        await anchor.delete(api);
      }
    });
  }
);
