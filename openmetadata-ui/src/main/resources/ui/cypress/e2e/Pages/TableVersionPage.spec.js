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
// / <reference types="Cypress" />

import {
  addOwner,
  addTier,
  deleteCreatedService,
  goToAddNewServicePage,
  interceptURL,
  mySqlConnectionInput,
  removeOwner,
  removeTier,
  testServiceCreationAndIngestion,
  uuid,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { visitEntityDetailsVersionPage } from '../../common/VersionUtils';
import { API_SERVICE, SERVICE_TYPE } from '../../constants/constants';

const owner = 'Amber Green';
const tier = 'Tier1';
const serviceType = 'Mysql';
const serviceName = `${serviceType}-cypress-${uuid()}`;
const tableFQN = `${serviceName}.default.cypress_integrations_test_db.team_entity`;

const tableDetails = {
  term: 'team_entity',
  displayName: 'team_entity',
  entity: 'tables',
  serviceName: serviceName,
  entityType: 'Table',
  schema: 'cypress_integrations_test_db',
  database: 'default',
  fqn: tableFQN,
};
const payload1 = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/tableConstraints/0',
    value: {
      constraintType: 'UNIQUE',
      columns: ['deleted', 'name'],
    },
  },
  {
    op: 'add',
    path: '/tableConstraints/1',
    value: {
      constraintType: 'PRIMARY_KEY',
      columns: ['deleted'],
    },
  },
  {
    op: 'replace',
    path: '/columns/3/name',
    value: 'updatedAt_date',
  },
  {
    op: 'replace',
    path: '/columns/0/constraint',
    value: 'NOT_NULL',
  },
  {
    op: 'add',
    path: '/columns/0/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.Personal',
    },
  },
  {
    op: 'add',
    path: '/columns/0/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'add',
    path: '/columns/0/description',
    value: "Column 'id' description.",
  },
  {
    op: 'add',
    path: '/description',
    value: 'Description for team_entity table.',
  },
];

describe('Table version pages should work properly', () => {
  let tableId;

  beforeEach(() => {
    cy.login();
  });

  it('Prerequisite', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput: mySqlConnectionInput,
      undefined,
      serviceName,
      serviceCategory: SERVICE_TYPE.Database,
    });

    const token = localStorage.getItem('oidcIdToken');

    cy.request({
      method: 'GET',
      url: `/api/v1/tables/name/${tableFQN}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      tableId = response.body.id;

      cy.request({
        method: 'PATCH',
        url: `/api/v1/tables/${tableId}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json-patch+json',
        },
        body: payload1,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  it('All the table version changes should be displayed properly', () => {
    visitEntityDetailsVersionPage(tableDetails, tableId, '1.1');

    // Table description diff check
    cy.get('[data-testid="diff-added-Description for team_entity table."]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="entity-right-panel"] [data-testid="tags"]').as(
      'entityTags'
    );

    cy.get('@entityTags').should('have.class', 'diff-added');

    cy.get(
      '[data-testid="entity-right-panel"] [data-testid="tags"] [data-testid="tag-PersonalData.Personal"]'
    )
      .scrollIntoView()
      .should('be.visible');

    // Check deleted column details diff
    cy.get('[data-testid="diff-removed-updatedAt"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="diff-removed-bigint"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get(
      '[data-row-key="id"] [data-testid="constraint-icon-not-null"]'
    ).should('have.class', 'diff-added');
    cy.get(
      `[data-row-key="id"] [data-testid="diff-added-Column 'id' description."]`
    ).should('have.class', 'diff-added');

    cy.get(`[data-row-key="id"] [data-testid="tags"]`).each(
      (item, index, list) => {
        expect(list).to.have.length(2);
        expect(Cypress.$(item)).to.have.class('diff-added');
      }
    );

    // Check constraint changes for 'name' column
    cy.get(
      '[data-row-key="name"] [data-testid="constraint-icon-unique"]'
    ).should('have.class', 'diff-added');

    // Check added column details diff
    cy.get('[data-testid="diff-added-updatedAt_date"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="diff-added-bigint"]')
      .scrollIntoView()
      .should('be.visible');

    // Check added table constraints for 'deleted' column
    cy.get(
      '[data-row-key="deleted"] [data-testid="constraint-icon-unique"]'
    ).should('have.class', 'diff-added');
    cy.get(
      '[data-row-key="deleted"] [data-testid="constraint-icon-primary-key"]'
    ).should('have.class', 'diff-added');
  });

  it('Changing owner should reflect in version changes', () => {
    visitEntityDetailsPage(
      tableDetails.term,
      tableDetails.serviceName,
      tableDetails.entity,
      undefined,
      tableDetails.entityType
    );

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('1.1');

    addOwner(owner, tableDetails.entity);

    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/name/${tableDetails.fqn}?include=all`,
      'getTableDetails'
    );
    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/${tableId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/${tableId}/versions/1.2`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('1.2').click();

    verifyResponseStatusCode('@getTableDetails', 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-added-${owner}"]`)
      .scrollIntoView()
      .should('be.visible');

    cy.get('@versionButton').contains('1.2').click();

    removeOwner(tableDetails.entity);

    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/${tableId}/versions/1.3`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('1.3').click();

    verifyResponseStatusCode('@getTableDetails', 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-removed-${owner}"]`)
      .scrollIntoView()
      .should('be.visible');
  });

  it('Changing tier should reflect in version changes', () => {
    visitEntityDetailsPage(
      tableDetails.term,
      tableDetails.serviceName,
      tableDetails.entity,
      undefined,
      tableDetails.entityType
    );

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('1.3');

    addTier(tier, tableDetails.entity);

    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/name/${tableDetails.fqn}?include=all`,
      'getTableDetails'
    );
    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/${tableId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/${tableId}/versions/1.4`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('1.4').click();

    verifyResponseStatusCode('@getTableDetails', 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-added-${tier}"]`)
      .scrollIntoView()
      .should('be.visible');

    cy.get('@versionButton').contains('1.4').click();

    removeTier(tableDetails.entity);

    interceptURL(
      'GET',
      `/api/v1/${tableDetails.entity}/${tableId}/versions/1.5`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('1.5').click();

    verifyResponseStatusCode('@getTableDetails', 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-removed-${tier}"]`)
      .scrollIntoView()
      .should('be.visible');
  });

  it('Cleanup for TableVersionPage tests', () => {
    deleteCreatedService(
      SERVICE_TYPE.Database,
      serviceName,
      API_SERVICE.databaseServices
    );
  });
});
