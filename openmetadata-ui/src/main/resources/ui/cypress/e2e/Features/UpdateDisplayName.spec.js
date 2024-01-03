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
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  createEntityTable,
  createSingleLevelEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import { visitServiceDetailsPage } from '../../common/serviceUtils';
import {
  DATABASE_SERVICE,
  SINGLE_LEVEL_SERVICE,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';
import {
  DASHBOARD_DATA_MODEL,
  SCHEMA_AND_DATABASE_DISPLAY_NAME,
} from '../../constants/updateDisplayName.constant';

const updateDisplayName = (displayName, apiPath) => {
  if (apiPath) {
    interceptURL('PATCH', apiPath, 'patchDisplayName');
  }
  cy.get('[data-testid="manage-button"]')
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-menu-id*="delete-button"]')
    .should('exist')
    .should('be.visible');
  cy.get('[data-testid="rename-button"]').should('be.visible').click();

  cy.get('#name').should('be.visible').should('be.disabled');
  cy.get('#displayName').should('be.visible').should('not.be.disabled').clear();
  cy.get('.ant-modal-footer').should('contain', 'Cancel');
  cy.get('#displayName').type(displayName);
  cy.get('[data-testid="save-button"]').should('be.visible').click();

  if (apiPath) {
    verifyResponseStatusCode('@patchDisplayName', 200);
  }

  cy.get('[data-testid="entity-header-display-name"]').should(
    'contain',
    displayName
  );
};

describe('Edit displayName for all the entities, services and verify breadcrumb', () => {
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
  });

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
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it(`dataModel`, () => {
    interceptURL(
      'GET',
      '/api/v1/dashboard/datamodels?service=*',
      'dashboardDataModel'
    );
    interceptURL(
      'GET',
      '/api/v1/dashboard/datamodels/name/*',
      'dataModelDetails'
    );
    visitServiceDetailsPage(
      {
        type: DASHBOARD_DATA_MODEL.service.type,
        name: DASHBOARD_DATA_MODEL.service.name,
      },
      false
    );
    verifyResponseStatusCode('@dashboardDataModel', 200);
    cy.get('[data-testid="data-model"]').should('be.visible').click();
    cy.get('[data-testid="data-models-table"]')
      .contains(DASHBOARD_DATA_MODEL.name)
      .click();
    verifyResponseStatusCode('@dataModelDetails', 200);
    updateDisplayName(
      DASHBOARD_DATA_MODEL.displayName,
      `/api/v1/dashboard/datamodels/*`
    );
    DASHBOARD_DATA_MODEL.breadcrumb.map((value) => {
      cy.get('[data-testid="breadcrumb"]').should('contain', value);
    });
  });

  it(`database`, () => {
    interceptURL('GET', 'api/v1/databases/name/*', 'database');
    visitEntityDetailsPage({
      term: SCHEMA_AND_DATABASE_DISPLAY_NAME.name,
      serviceName: SCHEMA_AND_DATABASE_DISPLAY_NAME.serviceName,
      entity: SCHEMA_AND_DATABASE_DISPLAY_NAME.entity,
    });
    cy.log(SCHEMA_AND_DATABASE_DISPLAY_NAME.database);
    cy.get('[data-testid="breadcrumb"]')
      .contains(SCHEMA_AND_DATABASE_DISPLAY_NAME.database)
      .click();
    verifyResponseStatusCode('@database', 200);
    updateDisplayName(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.databaseDisplayName,
      `/api/v1/databases/*`
    );
    SCHEMA_AND_DATABASE_DISPLAY_NAME.databaseBreadcrumb.map((value) => {
      cy.get('[data-testid="breadcrumb"]').should('contain', value);
    });
  });

  it(`databaseSchema`, () => {
    interceptURL('GET', 'api/v1/databaseSchemas/name/*', 'databaseSchemas');
    visitEntityDetailsPage({
      term: SCHEMA_AND_DATABASE_DISPLAY_NAME.name,
      serviceName: SCHEMA_AND_DATABASE_DISPLAY_NAME.serviceName,
      entity: SCHEMA_AND_DATABASE_DISPLAY_NAME.entity,
    });
    cy.get('[data-testid="breadcrumb"]')
      .contains(SCHEMA_AND_DATABASE_DISPLAY_NAME.schema)
      .click();
    verifyResponseStatusCode('@databaseSchemas', 200);
    updateDisplayName(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.schemaDisplayName,
      `/api/v1/databaseSchemas/*`
    );
    SCHEMA_AND_DATABASE_DISPLAY_NAME.schemaBreadcrumb.map((value) => {
      cy.get('[data-testid="breadcrumb"]').should('contain', value);
    });
  });
});
