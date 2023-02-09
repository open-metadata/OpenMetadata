/*
 *  Copyright 2022 Collate.
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
  interceptURL,
  login,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  BASE_URL,
  SEARCH_ENTITY_DASHBOARD,
  SEARCH_ENTITY_PIPELINE,
  SEARCH_ENTITY_TABLE,
  SEARCH_ENTITY_TOPIC,
} from '../../constants/constants';
import { NAVBAR_DETAILS } from '../../constants/redirections.constants';

const CREDENTIALS = {
  firstName: 'Test_Data_Consumer',
  lastName: 'User_Data_consumer',
  email: 'test_dataconsumer@openmetadata.org',
  password: 'User@OMD123',
};

const policy = 'Data Consumer';
const ENTITIES = {
  table: SEARCH_ENTITY_TABLE.table_1,
  topic: SEARCH_ENTITY_TOPIC.topic_1,
  dashboard: SEARCH_ENTITY_DASHBOARD.dashboard_1,
  pipeline: SEARCH_ENTITY_PIPELINE.pipeline_1,
};

const glossary = NAVBAR_DETAILS.glossary;
const tag = NAVBAR_DETAILS.tags;

const ID = {
  teams: {
    testid: '[data-menu-id*="teams"]',
    button: 'add-team',
  },
  users: {
    testid: '[data-menu-id*="users"]',
    button: 'add-user',
  },
  admins: {
    testid: '[data-menu-id*="admins"]',
    button: 'add-user',
  },
  roles: {
    testid: '[data-menu-id*="roles"]',
    button: 'add-role',
  },
  policies: {
    testid: '[data-menu-id*="policies"]',
    button: 'add-policy',
  },
  databases: {
    testid: '[data-menu-id*="databases"]',
    button: 'add-service-button',
  },
  messaging: {
    testid: '[data-menu-id*="messaging"]',
    button: 'add-service-button',
  },
  dashboard: {
    testid: '[data-menu-id*="services.dashboards"]',
    button: 'add-service-button',
  },
  pipelines: {
    testid: '[data-menu-id*="services.pipelines"]',
    button: 'add-service-button',
  },
  mlmodels: {
    testid: '[data-menu-id*="services.mlModels"]',
    button: 'add-service-button',
  },
  metadata: {
    testid: '[data-menu-id*="metadata"]',
    button: 'add-service-button',
  },
  customAttributesTable: {
    testid: '[data-menu-id*="tables"]',
    button: 'add-field-button',
  },
  customAttributesTopics: {
    testid: '[data-menu-id*="topics"]',
    button: 'add-field-button',
  },
  customAttributesDashboards: {
    testid: '[data-menu-id*="customAttributes.dashboards"]',
    button: 'add-field-button',
  },
  customAttributesPipelines: {
    testid: '[data-menu-id*="customAttributes.pipelines"]',
    button: 'add-field-button',
  },
  customAttributesMlModels: {
    testid: '[data-menu-id*="customAttributes.mlModels"]',
    button: 'add-field-button',
  },
  bots: {
    testid: '[data-menu-id*="bots"]',
    button: 'add-bot',
  },
};

describe('DataConsumer Edit policy should work properly', () => {
  it('Create a new account and assign Data consumer role to the user', () => {
    interceptURL('GET', 'api/v1/system/config/auth', 'getLoginPage');
    cy.visit('/');
    verifyResponseStatusCode('@getLoginPage', 200);
    // Click on create account button
    cy.get('[data-testid="signup"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    // Enter first name
    cy.get('[id="firstName"]').should('be.visible').type(CREDENTIALS.firstName);
    cy.get('[id="firstName"]').should('have.value', CREDENTIALS.firstName);
    // Enter last name
    cy.get('[id="lastName"]').should('be.visible').type(CREDENTIALS.lastName);
    cy.get('[id="lastName"]').should('have.value', CREDENTIALS.lastName);
    // Enter email
    cy.get('[id="email"]').should('be.visible').type(CREDENTIALS.email);
    cy.get('[id="email"]').should('have.value', CREDENTIALS.email);
    // Enter password
    cy.get('[id="password"]').should('be.visible').type(CREDENTIALS.password);
    cy.get('[id="password"]')
      .should('have.attr', 'type')
      .should('eq', 'password');

    // Confirm password
    cy.get('[id="confirmPassword"]')
      .should('be.visible')
      .type(CREDENTIALS.password);
    // Click on create account button
    cy.get('.ant-btn').contains('Create Account').should('be.visible').click();
    cy.url().should('eq', `${BASE_URL}/signin`).and('contain', 'signin');

    // Login with the created user

    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage();
    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Verify user profile
    cy.get('[data-testid="avatar"]')
      .first()
      .should('be.visible')
      .trigger('mouseover')
      .click();

    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .invoke('text')
      .should('contain', `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`);
    interceptURL('GET', 'api/v1/users/name/*', 'getUserPage');
    cy.get('[data-testid="user-name"]')
      .should('be.visible')
      .click({ force: true });
    verifyResponseStatusCode('@getUserPage', 200);
    cy.get('[data-testid="left-panel"]').should(
      'contain',
      `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`
    );

    cy.get('[data-testid="left-panel"]')
      .should('be.visible')
      .should('contain', policy);
  });

  it('Check if the new user has only edit access on description and tags', () => {
    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage();
    cy.url().should('eq', `${BASE_URL}/my-data`);

    Object.values(ENTITIES).forEach((entity) => {
      visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);
      // Check Edit description
      cy.get('[data-testid="edit-description"]')
        .should('be.visible')
        .should('not.be.disabled')
        .click({ force: true });
      cy.get('[data-testid="header"]')
        .should('be.visible')
        .invoke('text')
        .should('eq', `Edit Description for ${entity.displayName}`);

      cy.get('[data-testid="cancel"]').should('be.visible').click();

      // Navigate to lineage tab
      cy.get('[data-testid="Lineage"]').should('be.visible').click();

      // Check if edit lineage button is disabled
      cy.get('[data-testid="edit-lineage"]')
        .should('be.visible')
        .and('be.disabled');

      cy.get('[id="openmetadata_logo"]').scrollIntoView().click();
    });

    // Check if tags is editable for table
    visitEntityDetailsPage(
      ENTITIES.table.term,
      ENTITIES.table.serviceName,
      ENTITIES.table.entity
    );

    cy.get('[data-testid="add-tag"]')
      .should('be.visible')
      .should('not.be.disabled')
      .first()
      .click();
    cy.get('[data-testid="tag-selector"]').should('be.visible');

    // Check if tags is editable for dashboard
    visitEntityDetailsPage(
      ENTITIES.dashboard.term,
      ENTITIES.dashboard.serviceName,
      ENTITIES.dashboard.entity
    );

    cy.get('[data-testid="add-tag"]')
      .should('be.visible')
      .should('not.be.disabled')
      .first()
      .click();
    cy.get('[data-testid="tag-selector"]').should('be.visible');
  });

  it('Check for CRUD operations to be disabled for the user for glossary and tags', () => {
    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage();
    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Check CRUD for Glossary
    cy.get(glossary.testid)
      .should('be.visible')
      .click({ animationDistanceThreshold: 10 });
    if (glossary.subMenu) {
      cy.get(glossary.subMenu).should('be.visible').click({ force: true });
    }
    cy.get('body').click();

    cy.get('[data-testid="add-glossary"]')
      .should('be.visible')
      .should('be.disabled');

    cy.clickOnLogo();

    // Check CRUD for Tags
    cy.get(tag.testid)
      .should('be.visible')
      .click({ animationDistanceThreshold: 10 });
    if (tag.subMenu) {
      cy.get(tag.subMenu).should('be.visible').click({ force: true });
    }
    cy.get('body').click();
    cy.wait(200);
    cy.get('[data-testid="add-new-tag-button"]')
      .should('be.visible')
      .should('be.disabled');

    cy.get('[data-testid="delete-classification-or-tag"]')
      .should('be.visible')
      .should('be.disabled');
  });

  it('Check CRUD operations for settings page', () => {
    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage();
    cy.url().should('eq', `${BASE_URL}/my-data`);
    // Navigate to settings
    cy.get(NAVBAR_DETAILS.settings.testid).should('be.visible').click();
    Object.values(ID).forEach((id) => {
      cy.get(id.testid).should('be.visible').click();
      cy.get(`[data-testid="${id.button}"]`)
        .should('be.visible')
        .should('be.disabled');
    });
  });
});
