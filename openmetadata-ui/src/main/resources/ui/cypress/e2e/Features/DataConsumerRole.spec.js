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
  deleteUser,
  interceptURL,
  login,
  signupAndLogin,
  uuid,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  createEntityTable,
  createSingleLevelEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import { BASE_URL } from '../../constants/constants';
import {
  DATABASE_SERVICE,
  SINGLE_LEVEL_SERVICE,
  VISIT_ENTITIES_DATA,
} from '../../constants/EntityConstant';
import { NAVBAR_DETAILS } from '../../constants/redirections.constants';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const CREDENTIALS = {
  firstName: 'Test_Data_Consumer',
  lastName: 'User_Data_consumer',
  email: `test_dataconsumer${uuid()}@openmetadata.org`,
  password: 'User@OMD123',
};
const { dashboard, pipeline, table, topic } = VISIT_ENTITIES_DATA;
const policy = 'Data Consumer';
const ENTITIES = {
  dashboard,
  pipeline,
  table,
  topic,
};

const glossary = NAVBAR_DETAILS.glossary;
const tag = NAVBAR_DETAILS.tags;

const ID = {
  teams: {
    testid: '[data-menu-id*="teams"]',
    button: 'add-team',
    api: '/api/v1/teams/name/Organization?*',
  },
  users: {
    testid: '[data-menu-id*="users"]',
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  admins: {
    testid: '[data-menu-id*="admins"]',
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  databases: {
    testid: '[data-menu-id*="databases"]',
    button: 'add-service-button',
    api: '/api/v1/services/databaseServices?*',
  },
  messaging: {
    testid: '[data-menu-id*="messaging"]',
    button: 'add-service-button',
    api: '/api/v1/services/messagingServices?*',
  },
  dashboard: {
    testid: '[data-menu-id*="services.dashboards"]',
    button: 'add-service-button',
    api: '/api/v1/services/dashboardServices?*',
  },
  pipelines: {
    testid: '[data-menu-id*="services.pipelines"]',
    button: 'add-service-button',
    api: '/api/v1/services/pipelineServices?*',
  },
  mlmodels: {
    testid: '[data-menu-id*="services.mlmodels"]',
    button: 'add-service-button',
    api: '/api/v1/services/mlmodelServices?*',
  },
  storage: {
    testid: '[data-menu-id*="services.storages"]',
    button: 'add-service-button',
    api: '/api/v1/services/storageServices?*',
  },
};
const PERMISSIONS = {
  metadata: {
    testid: '[data-menu-id*="metadata"]',
  },
  customAttributesTable: {
    testid: '[data-menu-id*="tables"]',
  },
  customAttributesTopics: {
    testid: '[data-menu-id*="topics"]',
  },
  customAttributesDashboards: {
    testid: '[data-menu-id*="customAttributes.dashboards"]',
  },
  customAttributesPipelines: {
    testid: '[data-menu-id*="customAttributes.pipelines"]',
  },
  customAttributesMlModels: {
    testid: '[data-menu-id*="customAttributes.mlModels"]',
  },
  bots: {
    testid: '[data-menu-id*="bots"]',
  },
};

describe('DataConsumer Edit policy should work properly', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });
      SINGLE_LEVEL_SERVICE.forEach((data) => {
        createSingleLevelEntity({
          token,
          ...data,
          entity: [data.entity],
        });
      });
    });
    cy.logout();
  });

  after(() => {
    Cypress.session.clearAllSavedSessions();
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
    });
    deleteUser(CREDENTIALS.id);
  });

  it('Create a new account and assign Data consumer role to the user', () => {
    signupAndLogin(
      CREDENTIALS.email,
      CREDENTIALS.password,
      CREDENTIALS.firstName,
      CREDENTIALS.lastName
    ).then((id) => {
      CREDENTIALS.id = id;

      cy.clickOutside();

      // click the collapse button to open the other details
      cy.get(
        '[data-testid="user-profile"] .ant-collapse-expand-icon > .anticon > svg'
      ).click();

      cy.get(
        '[data-testid="user-profile"] [data-testid="user-profile-inherited-roles"]'
      ).should('contain', policy);
    });
  });

  it('Check if the new user has only edit access on description and tags', () => {
    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage(true);
    cy.url().should('eq', `${BASE_URL}/my-data`);

    Object.values(ENTITIES).forEach((entity) => {
      visitEntityDetailsPage({
        term: entity.term,
        serviceName: entity.serviceName,
        entity: entity.entity,
      });
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
      cy.get('[data-testid="lineage"]').should('be.visible').click();

      // Check if edit lineage button is disabled
      cy.get('[data-testid="edit-lineage"]')
        .should('be.visible')
        .and('be.disabled');

      cy.get('[id="openmetadata_logo"]').scrollIntoView().click();
    });

    // Check if tags is editable for table
    visitEntityDetailsPage({
      term: ENTITIES.table.term,
      serviceName: ENTITIES.table.serviceName,
      entity: ENTITIES.table.entity,
    });

    cy.get('[data-testid="add-tag"]')
      .should('be.visible')
      .should('not.be.disabled')
      .first()
      .click();
    cy.get('[data-testid="tag-selector"]').should('be.visible');

    // Check if tags is editable for dashboard

    visitEntityDetailsPage({
      term: ENTITIES.dashboard.term,
      serviceName: ENTITIES.dashboard.serviceName,
      entity: ENTITIES.dashboard.entity,
    });

    cy.get('[data-testid="add-tag"]')
      .should('be.visible')
      .should('not.be.disabled')
      .first()
      .click();
    cy.get('[data-testid="tag-selector"]').should('be.visible');
  });

  it('Check for CRUD operations to not exist for the user for glossary and tags', () => {
    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage(true);
    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Check CRUD for Glossary

    cy.sidebarHover();

    cy.get(glossary.testid)
      .should('be.visible')
      .click({ animationDistanceThreshold: 10 });
    if (glossary.subMenu) {
      cy.get(glossary.subMenu).should('be.visible').click({ force: true });

      cy.sidebarHoverOutside();
    }
    cy.get('body').click();

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
    cy.get('[data-testid="add-new-tag-button"]').should('not.exist');

    cy.get('[data-testid="manage-button"]').should('not.exist');
  });

  it('Check CRUD operations for settings page', () => {
    login(CREDENTIALS.email, CREDENTIALS.password);
    cy.goToHomePage(true);
    cy.url().should('eq', `${BASE_URL}/my-data`);
    // Navigate to settings
    cy.get(NAVBAR_DETAILS.settings.testid).should('be.visible').click();
    Object.values(ID).forEach((id) => {
      if (id?.api) {
        interceptURL('GET', id.api, 'getTabDetails');
      }

      cy.get(id.testid).should('be.visible').click();
      if (id?.api) {
        verifyResponseStatusCode('@getTabDetails', 200);
      }

      cy.get(`[data-testid="${id.button}"]`).should('not.be.exist');
    });

    Object.values(PERMISSIONS).forEach((id) => {
      if (id.testid === '[data-menu-id*="metadata"]') {
        cy.get(id.testid).should('be.visible').click();
      } else {
        cy.get(id.testid).should('not.be.exist');
      }
    });
  });
});
