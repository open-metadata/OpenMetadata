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
  descriptionBox,
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  DELETE_TERM,
  SEARCH_ENTITY_DASHBOARD,
  SEARCH_ENTITY_MLMODEL,
  SEARCH_ENTITY_PIPELINE,
  SEARCH_ENTITY_TABLE,
  SEARCH_ENTITY_TOPIC,
} from '../../constants/constants';

const ENTITIES = {
  table: {
    ...SEARCH_ENTITY_TABLE.table_4,
    schema: 'shopify',
    database: 'ecommerce_db',
  },
  topic: SEARCH_ENTITY_TOPIC.topic_2,
  dashboard: SEARCH_ENTITY_DASHBOARD.dashboard_2,
  pipeline: SEARCH_ENTITY_PIPELINE.pipeline_2,
  mlmodel: SEARCH_ENTITY_MLMODEL.mlmodel_2,
};
const glossary = 'GlossaryOwnerTest';
const glossaryTerm = 'GlossaryTermOwnerTest';

const OWNER = 'Aaron Singh';
const TIER = 'Tier1';

const addRemoveOwner = () => {
  cy.get('[data-testid="edit-owner"]').click();

  cy.get('.ant-tabs [id*=tab-users]').click();
  verifyResponseStatusCode('@getUsers', 200);
  cy.get(`.ant-popover [title="${OWNER}"]`).click();
  verifyResponseStatusCode('@patchOwner', 200);
  cy.get('[data-testid="owner-link"]').should('contain', OWNER);
  cy.get('[data-testid="edit-owner"]').click();

  cy.get('[data-testid="remove-owner"]').click();
  verifyResponseStatusCode('@patchOwner', 200);
  cy.get('[data-testid="owner-link"]').should('contain', 'No Owner');
};

const addRemoveTier = () => {
  cy.get('[data-testid="edit-tier"]').click();
  cy.get('[data-testid="card-list"]').first().should('be.visible').as('tier1');
  cy.get('@tier1')
    .find('[data-testid="icon"] > [data-testid="select-tier-button"]')
    .click();
  verifyResponseStatusCode('@patchOwner', 200);
  cy.clickOutside();
  cy.get('[data-testid="Tier"]').should('contain', TIER);

  cy.get('[data-testid="edit-tier"]').click();
  cy.get('[data-testid="card-list"]').first().should('be.visible').as('tier1');
  cy.get('@tier1').find('[data-testid="remove-tier"]').click();

  verifyResponseStatusCode('@patchOwner', 200);
  cy.get('[data-testid="Tier"]').should('contain', 'No Tier');
};

describe('Add and Remove Owner and Tier', () => {
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
      interceptURL('PATCH', `/api/v1/${value.entity}/*`, 'patchOwner');

      visitEntityDetailsPage(value.term, value.serviceName, value.entity);
      verifyResponseStatusCode('@entityPermission', 200);
      verifyResponseStatusCode('@activityFeed', 200);

      addRemoveOwner();
    });
  });

  it('databaseSchema details page', () => {
    interceptURL('PATCH', '/api/v1/databaseSchemas/*', 'patchOwner');
    interceptURL('GET', '/api/v1/*/name/*', 'schemaDetails');
    const value = ENTITIES.table;
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    cy.get('[data-testid="breadcrumb"]')
      .should('be.visible')
      .contains(value.schema)
      .click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@schemaDetails', 200);
    verifyResponseStatusCode('@activityFeed', 200);
    addRemoveOwner();
  });

  it('database details page', () => {
    interceptURL('PATCH', '/api/v1/databases/*', 'patchOwner');
    interceptURL('GET', '/api/v1/databases/name/*', 'databaseDetails');
    const value = ENTITIES.table;
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    cy.get('[data-testid="breadcrumb"]')
      .should('be.visible')
      .contains(value.database)
      .click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@databaseDetails', 200);
    verifyResponseStatusCode('@activityFeed', 200);
    addRemoveOwner();
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
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    cy.get('[data-testid="breadcrumb"]')
      .should('be.visible')
      .contains(value.serviceName)
      .click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@serviceDetails', 200);
    verifyResponseStatusCode('@databases', 200);

    addRemoveOwner();
  });

  it('Test suite details page', () => {
    interceptURL('PATCH', '/api/v1/dataQuality/testSuites/*', 'patchOwner');
    interceptURL('GET', '/api/v1/dataQuality/testSuites?*', 'testSuites');
    interceptURL(
      'GET',
      '/api/v1/dataQuality/testSuites/name/myLogicalTestSuite?fields=*',
      'testSuiteDetails'
    );
    interceptURL('GET', '/api/v1/dataQuality/testCases?*', 'testCases');
    cy.get('[data-testid="appbar-item-data-quality"]')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@testSuites', 200);

    cy.get('[data-testid="by-test-suites"]').click();
    verifyResponseStatusCode('@testSuites', 200);

    cy.get('[data-testid="test-suite-container"]')
      .contains('myLogicalTestSuite')
      .click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@testSuiteDetails', 200);
    verifyResponseStatusCode('@testCases', 200);
    addRemoveOwner();
  });

  it('Teams details page', () => {
    interceptURL('PATCH', '/api/v1/teams/*', 'patchOwner');
    interceptURL('GET', '/api/v1/permissions/team/*', 'teamPermission');
    interceptURL(
      'GET',
      '/api/v1/teams/name/Organization?fields=*',
      'getOrganization'
    );
    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@getOrganization', 200);
    verifyResponseStatusCode('@teamPermission', 200);

    interceptURL(
      'GET',
      'api/v1/search/query?q=**%20AND%20isBot:false&from=0&size=0&index=user_search_index',
      'waitForUsers'
    );

    // Click on edit owner button
    cy.get('[data-testid="edit-owner"]').click();
    verifyResponseStatusCode('@waitForUsers', 200);

    cy.get('.user-team-select-popover').contains('Users').click();

    cy.get('[data-testid="selectable-list"]')
      .eq(1)
      .find(`[title="${OWNER}"]`)
      .click();

    verifyResponseStatusCode('@patchOwner', 200);
    cy.get('[data-testid="owner-link"]')
      .should('be.visible')
      .should('contain', OWNER);
    cy.get('[data-testid="edit-owner"]').should('be.visible').click();
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="remove-owner"]').should('be.visible').click();
    verifyResponseStatusCode('@patchOwner', 200);
    cy.get('[data-testid="owner-link"]')
      .should('be.visible')
      .should('contain', 'No Owner');
  });

  it('Glossary details page', () => {
    interceptURL('PATCH', '/api/v1/glossaries/*', 'patchOwner');
    interceptURL('POST', '/api/v1/glossaries', 'createGlossary');
    interceptURL('GET', '/api/v1/permissions/glossary/*', 'glossaryPermission');
    interceptURL('GET', '/api/v1/glossaries?*', 'getGlossaries');
    cy.get('[data-testid="governance"]').should('be.visible').click();
    cy.get('[data-testid="appbar-item-glossary"]')
      .should('be.visible')
      .click({ waitForAnimations: true });
    cy.get('[data-testid="add-placeholder-button"]')
      .should('be.visible')
      .click();
    cy.get('[data-testid="name"]').should('be.visible').type(glossary);
    cy.get(descriptionBox).scrollIntoView().should('be.visible').type(glossary);
    cy.get('[data-testid="save-glossary"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@createGlossary', 201);
    verifyResponseStatusCode('@getGlossaries', 200);
    verifyResponseStatusCode('@glossaryPermission', 200);

    cy.get('[data-testid="edit-owner"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.wait('@getUsers').then(() => {
      cy.get(`[title="${OWNER}"]`).should('be.visible').click();
      verifyResponseStatusCode('@patchOwner', 200);
    });

    cy.get('[data-testid="glossary-owner-name"]')
      .should('be.visible')
      .should('contain', OWNER);

    cy.reload();
    verifyResponseStatusCode('@glossaryPermission', 200);
    verifyResponseStatusCode('@getGlossaries', 200);

    cy.get('[data-testid="edit-owner"]').should('be.visible').click();
    cy.wait('@getUsers').then(() => {
      cy.get('[data-testid="remove-owner"]').should('be.visible').click();
      verifyResponseStatusCode('@patchOwner', 200);
    });
    cy.get('[data-testid="glossary-owner-name"] > [data-testid="Add"]').should(
      'be.visible'
    );
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
    cy.get('[data-testid="appbar-item-glossary"]')
      .should('be.visible')
      .click({ waitForAnimations: true });
    verifyResponseStatusCode('@getGlossaries', 200);
    verifyResponseStatusCode('@glossaryPermission', 200);
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

    cy.get('[data-testid="edit-owner"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.wait('@userProfile');
    cy.wait('@getUsers').then(() => {
      cy.get(`[title="${OWNER}"]`).should('be.visible').click();
      verifyResponseStatusCode('@patchOwner', 200);
    });
    cy.get('[data-testid="glossary-owner-name"]')
      .should('be.visible')
      .should('contain', OWNER);

    cy.reload();
    verifyResponseStatusCode('@glossaryTermPermission', 200);
    verifyResponseStatusCode('@getGlossaries', 200);

    cy.get('[data-testid="edit-owner"]').should('be.visible').click();
    cy.wait('@getUsers').then(() => {
      cy.get('[data-testid="remove-owner"]').should('be.visible').click();
      verifyResponseStatusCode('@patchOwner', 200);
    });
    cy.get('[data-testid="glossary-owner-name"] > [data-testid="Add"]').should(
      'be.visible'
    );
  });

  it('Delete glossary and glossaryTerm', () => {
    interceptURL('GET', '/api/v1/permissions/glossary/*', 'glossaryPermission');
    interceptURL('GET', '/api/v1/glossaries?*', 'getGlossaries');

    cy.get('[data-testid="governance"]').should('be.visible').click();
    cy.get('[data-testid="appbar-item-glossary"]')
      .should('be.visible')
      .click({ waitForAnimations: true });
    verifyResponseStatusCode('@getGlossaries', 200);
    verifyResponseStatusCode('@glossaryPermission', 200);
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
      interceptURL('PATCH', `/api/v1/${value.entity}/*`, 'patchOwner');

      visitEntityDetailsPage(value.term, value.serviceName, value.entity);
      verifyResponseStatusCode('@entityPermission', 200);
      verifyResponseStatusCode('@activityFeed', 200);

      addRemoveTier();
    });
  });

  it('database details page', () => {
    interceptURL('PATCH', '/api/v1/databases/*', 'patchOwner');
    interceptURL('GET', '/api/v1/databases/name/*', 'databaseDetails');
    const value = ENTITIES.table;
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    cy.get('[data-testid="breadcrumb"]')
      .should('be.visible')
      .contains(value.database)
      .click();
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@databaseDetails', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    addRemoveTier();
  });
});
