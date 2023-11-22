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
// eslint-disable-next-line spaced-comment
/// <reference types="Cypress" />

import {
  addOwner,
  addTier,
  descriptionBox,
  interceptURL,
  removeOwner,
  removeTier,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  createEntityTable,
  createSingleLevelEntity,
  createUserEntity,
  deleteEntityById,
  deleteUserEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import { DELETE_TERM, uuid } from '../../constants/constants';
import {
  DATABASE_SERVICE,
  SINGLE_LEVEL_SERVICE,
  STORED_PROCEDURE_DETAILS,
  VISIT_ENTITIES_DATA,
} from '../../constants/EntityConstant';
import { USER_CREDENTIALS } from '../../constants/SearchIndexDetails.constants';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const ENTITIES = {
  table: {
    ...VISIT_ENTITIES_DATA.table,
    schema: DATABASE_SERVICE.schema.name,
    database: DATABASE_SERVICE.database.name,
  },
  topic: VISIT_ENTITIES_DATA.topic,
  dashboard: VISIT_ENTITIES_DATA.dashboard,
  pipeline: VISIT_ENTITIES_DATA.pipeline,
  mlmodel: VISIT_ENTITIES_DATA.mlmodel,
  storedProcedure: VISIT_ENTITIES_DATA.storedProcedure,
};
const TEST_SUITE = { name: `aaa-cypress-test-suite-${uuid()}` };
const glossary = 'GlossaryOwnerTest';
const glossaryTerm = 'GlossaryTermOwnerTest';

const OWNER = `${USER_CREDENTIALS.firstName}${USER_CREDENTIALS.lastName}`;
const TIER = 'Tier1';

const addRemoveOwner = (ownerName, entity, isGlossaryPage) => {
  addOwner(ownerName, entity, isGlossaryPage);
  removeOwner(entity, isGlossaryPage);
};

const addRemoveTier = (tier, entity) => {
  addTier(tier, entity);

  removeTier(entity);
};

describe('Add and Remove Owner', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.tables],
      });
      SINGLE_LEVEL_SERVICE.forEach((data) => {
        createSingleLevelEntity({
          token,
          ...data,
          entity: [data.entity],
        });
      });

      // creating stored procedure
      cy.request({
        method: 'POST',
        url: `/api/v1/storedProcedures`,
        headers: { Authorization: `Bearer ${token}` },
        body: STORED_PROCEDURE_DETAILS,
      });

      // creating test suite
      cy.request({
        method: 'POST',
        url: `/api/v1/dataQuality/testSuites`,
        headers: { Authorization: `Bearer ${token}` },
        body: TEST_SUITE,
      });

      createUserEntity({ token, user: USER_CREDENTIALS });
    });
  });

  beforeEach(() => {
    interceptURL('GET', '/api/v1/permissions/*/name/*', 'entityPermission');
    interceptURL('GET', '/api/v1/feed/count?entityLink=*', 'activityFeed');
    interceptURL(
      'GET',
      '/api/v1/search/query?q=**teamType:Group&from=0&size=15&index=team_search_index',
      'getTeams'
    );
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    cy.login();
  });

  Object.entries(ENTITIES).map(([key, value]) => {
    it(`${key} details page`, () => {
      visitEntityDetailsPage({
        term: value.term,
        serviceName: value.serviceName,
        entity: value.entity,
        entityType: value.entityType,
      });
      verifyResponseStatusCode('@entityPermission', 200);
      verifyResponseStatusCode('@activityFeed', 200);

      addRemoveOwner(OWNER, value.entity);
    });
  });

  it('databaseSchema details page', () => {
    interceptURL('PATCH', '/api/v1/databaseSchemas/*', 'patchOwner');
    interceptURL('GET', '/api/v1/*/name/*', 'schemaDetails');
    const value = ENTITIES.table;
    visitEntityDetailsPage({
      term: value.term,
      serviceName: value.serviceName,
      entity: value.entity,
    });
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    // click to schema in breadcrumb
    cy.get(':nth-child(3) > .link-title').click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@schemaDetails', 200);
    verifyResponseStatusCode('@activityFeed', 200);
    addRemoveOwner(OWNER, 'databaseSchemas');
  });

  it('database details page', () => {
    interceptURL('PATCH', '/api/v1/databases/*', 'patchOwner');
    interceptURL('GET', '/api/v1/databases/name/*', 'databaseDetails');
    const value = ENTITIES.table;
    visitEntityDetailsPage({
      term: value.term,
      serviceName: value.serviceName,
      entity: value.entity,
    });
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    // click to database in breadcrumb
    cy.get(':nth-child(2) > .link-title').click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@databaseDetails', 200);
    verifyResponseStatusCode('@activityFeed', 200);
    addRemoveOwner(OWNER, 'databases');
  });

  it('service details page', () => {
    interceptURL('PATCH', '/api/v1/services/databaseServices/*', 'patchOwner');
    interceptURL(
      'GET',
      '/api/v1/services/databaseServices/name/*',
      'serviceDetails'
    );
    interceptURL(
      'GET',
      '/api/v1/services/ingestionPipelines/status',
      'ingestionPipelines'
    );
    interceptURL('GET', '/api/v1/databases?service=*', 'databases');
    const value = ENTITIES.table;

    visitEntityDetailsPage({
      term: value.term,
      serviceName: value.serviceName,
      entity: value.entity,
    });
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    // click to service in breadcrumb
    cy.get(':nth-child(1) > .link-title').click();

    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@serviceDetails', 200);
    verifyResponseStatusCode('@databases', 200);

    addRemoveOwner(OWNER, 'databaseServices');
  });

  it('Test suite details page', () => {
    interceptURL('PATCH', '/api/v1/dataQuality/testSuites/*', 'patchOwner');
    interceptURL('GET', '/api/v1/dataQuality/testSuites?*', 'testSuites');
    interceptURL(
      'GET',
      `/api/v1/dataQuality/testSuites/name/*`,
      'testSuiteDetails'
    );
    interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'testCases');
    cy.get('[data-testid="app-bar-item-data-quality"]')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@testSuites', 200);

    cy.get('[data-testid="by-test-suites"]').click();
    verifyResponseStatusCode('@testSuites', 200);

    // Get the first test suite from the table.
    cy.get(
      '[data-testid="test-suite-table"] .ant-table-tbody > :nth-child(1) > :nth-child(1) > a'
    ).click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@testSuiteDetails', 200);
    verifyResponseStatusCode('@testCases', 200);
    addRemoveOwner(OWNER, 'testSuites');
  });

  it('Teams details page', () => {
    interceptURL('PATCH', '/api/v1/teams/*', 'patchOwner');
    interceptURL('GET', '/api/v1/permissions/team/name/*', 'teamPermission');
    interceptURL(
      'GET',
      '/api/v1/teams/name/Organization?fields=*',
      'getOrganization'
    );
    cy.get('[data-testid="app-bar-item-settings"]')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@getOrganization', 200);
    verifyResponseStatusCode('@teamPermission', 200);

    addRemoveOwner(OWNER, 'teams');
  });

  it('Glossary details page', () => {
    interceptURL('PATCH', '/api/v1/glossaries/*', 'patchOwner');
    interceptURL('POST', '/api/v1/glossaries', 'createGlossary');
    interceptURL('GET', '/api/v1/permissions/glossary/*', 'glossaryPermission');
    interceptURL('GET', '/api/v1/glossaries?*', 'getGlossaries');
    cy.get('[data-testid="governance"]').should('be.visible').click();
    cy.get('[data-testid="app-bar-item-glossary"]').click({
      waitForAnimations: true,
      force: true,
    });
    verifyResponseStatusCode('@getGlossaries', 200);
    cy.get('[data-testid="add-glossary"]').click();
    cy.get('[data-testid="name"]').should('be.visible').type(glossary);
    cy.get(descriptionBox).scrollIntoView().should('be.visible').type(glossary);
    cy.get('[data-testid="save-glossary"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@createGlossary', 201);
    verifyResponseStatusCode('@getGlossaries', 200);
    verifyResponseStatusCode('@glossaryPermission', 200);

    addRemoveOwner(OWNER, 'glossaries', true);
  });

  it('GlossaryTerm details page', () => {
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'patchOwner');
    interceptURL('POST', '/api/v1/glossaryTerms', 'createGlossaryTerm');
    interceptURL('GET', '/api/v1/permissions/glossary/*', 'glossaryPermission');
    interceptURL(
      'GET',
      '/api/v1/permissions/glossaryTerm/*',
      'glossaryTermPermission'
    );
    interceptURL('GET', '/api/v1/glossaries?*', 'getGlossaries');
    interceptURL('GET', '/api/v1/glossaryTerms?*', 'getGlossaryTerms');
    interceptURL(
      'GET',
      '/api/v1/glossaryTerms/name/*',
      'getGlossaryTermDetails'
    );
    cy.get('[data-testid="governance"]').should('be.visible').click();
    cy.get('[data-testid="app-bar-item-glossary"]')
      .should('be.visible')
      .click({ waitForAnimations: true, force: true });
    verifyResponseStatusCode('@getGlossaries', 200);
    verifyResponseStatusCode('@glossaryPermission', 200);
    interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
    cy.get('.ant-menu-item').contains(glossary).should('be.visible').click();
    verifyResponseStatusCode('@getGlossaryTerms', 200);
    cy.get('[data-testid="add-new-tag-button-header"]')
      .should('be.visible')
      .click();
    cy.get('[data-testid="name"]').should('be.visible').type(glossaryTerm);
    cy.get(descriptionBox)
      .scrollIntoView()
      .should('be.visible')
      .type(glossaryTerm);
    cy.get('[data-testid="save-glossary-term"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@createGlossaryTerm', 201);
    verifyResponseStatusCode('@getGlossaryTerms', 200);

    cy.get(`[data-testid="${glossaryTerm}"]`).should('be.visible').click();
    verifyResponseStatusCode('@getGlossaryTermDetails', 200);
    verifyResponseStatusCode('@glossaryTermPermission', 200);
    verifyResponseStatusCode('@getGlossaryTerms', 200);

    addRemoveOwner(OWNER, 'glossaryTerms', true);
  });

  it('Delete glossary and glossaryTerm', () => {
    interceptURL('GET', '/api/v1/permissions/glossary/*', 'glossaryPermission');
    interceptURL('GET', '/api/v1/glossaries?*', 'getGlossaries');

    cy.get('[data-testid="governance"]').should('be.visible').click();
    cy.get('[data-testid="app-bar-item-glossary"]')
      .should('be.visible')
      .click({ waitForAnimations: true, force: true });
    verifyResponseStatusCode('@getGlossaries', 200);
    verifyResponseStatusCode('@glossaryPermission', 200);
    interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
    cy.get('.ant-menu-item').contains(glossary).should('be.visible').click();
    verifyResponseStatusCode('@getGlossaryTerms', 200);
    cy.get('[data-testid="manage-button"]').should('be.visible').click();
    cy.get('[data-testid="delete-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="delete-confirmation-modal"]')
      .should('exist')
      .then(() => {
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('[data-testid="modal-header"]').should('be.visible');
      });
    cy.get('[data-testid="modal-header"]')
      .should('be.visible')
      .should('contain', `Delete ${glossary}`);
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL('DELETE', '/api/v1/glossaries/*', 'getGlossary');
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.disabled')
      .click();
    verifyResponseStatusCode('@getGlossary', 200);
  });
});

describe('Add and Remove Tier', () => {
  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
      SINGLE_LEVEL_SERVICE.forEach((data) => {
        hardDeleteService({
          token,
          serviceFqn: data.service.name,
          serviceType: data.serviceType,
        });
      });
      deleteUserEntity({ token, id: USER_CREDENTIALS.id });

      // Delete test suite
      deleteEntityById({
        entityFqn: TEST_SUITE.name,
        entityType: 'dataQuality/testSuites',
        token,
      });
    });
  });

  beforeEach(() => {
    interceptURL('GET', '/api/v1/permissions/*/name/*', 'entityPermission');
    interceptURL('GET', '/api/v1/feed/count?entityLink=*', 'activityFeed');
    interceptURL(
      'GET',
      '/api/v1/search/query?q=**teamType:Group&from=0&size=15&index=team_search_index',
      'getTeams'
    );
    interceptURL('GET', '/api/v1/users?&isBot=false&limit=15', 'getUsers');
    cy.login();
  });

  Object.entries(ENTITIES).map(([key, value]) => {
    it(`${key} details page`, () => {
      visitEntityDetailsPage({
        term: value.term,
        serviceName: value.serviceName,
        entity: value.entity,
        entityType: value.entityType,
      });
      verifyResponseStatusCode('@entityPermission', 200);
      verifyResponseStatusCode('@activityFeed', 200);

      addRemoveTier(TIER, value.entity);
    });
  });

  it('database details page', () => {
    interceptURL('GET', '/api/v1/databases/name/*', 'databaseDetails');
    const value = ENTITIES.table;
    visitEntityDetailsPage({
      term: value.term,
      serviceName: value.serviceName,
      entity: value.entity,
    });
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    cy.get('[data-testid="breadcrumb"]')
      .should('be.visible')
      .contains(value.database)
      .click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@databaseDetails', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    addRemoveTier(TIER, 'databases');
  });
});
