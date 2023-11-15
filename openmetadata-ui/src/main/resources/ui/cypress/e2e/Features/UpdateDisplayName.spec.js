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
import { visitServiceDetailsPage } from '../../common/serviceUtils';
import { MYDATA_SUMMARY_OPTIONS } from '../../constants/constants';
import {
  DASHBOARD_DATA_MODEL,
  ENTITIES_DISPLAY_NAME,
  SCHEMA_AND_DATABASE_DISPLAY_NAME,
  SERVICES,
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
  beforeEach(() => {
    cy.login();
  });

  Object.entries(SERVICES).map(([serviceType, service]) => {
    it(`${service.type}`, () => {
      visitServiceDetailsPage(service, false);
      updateDisplayName(
        service.displayName,
        `/api/v1/services/${serviceType}/*`
      );
    });
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
    visitEntityDetailsPage(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.name,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.serviceName,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.entity
    );
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
    visitEntityDetailsPage(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.name,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.serviceName,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.entity
    );
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

  Object.values(ENTITIES_DISPLAY_NAME).map((entity) => {
    it(`${entity.entity}`, () => {
      visitEntityDetailsPage(entity.name, entity.serviceName, entity.entity);
      updateDisplayName(entity.displayName, `/api/v1/${entity.entity}/*`);
      entity.breadcrumb.map((value) => {
        cy.get('[data-testid="breadcrumb"]').should('contain', value);
      });
    });
  });
});

describe('Cleanup', () => {
  beforeEach(() => {
    cy.login();
  });

  Object.values(ENTITIES_DISPLAY_NAME).map((entity) => {
    it(`${entity.entity}`, () => {
      if (entity.entity === MYDATA_SUMMARY_OPTIONS.dashboards) {
        visitEntityDetailsPage(
          entity.displayName,
          entity.serviceName,
          entity.entity
        );
      } else {
        visitEntityDetailsPage(entity.name, entity.serviceName, entity.entity);
      }
      updateDisplayName(entity.oldDisplayName, `/api/v1/${entity.entity}/*`);
    });
  });

  it(`databaseSchema`, () => {
    interceptURL('GET', 'api/v1/databaseSchemas/name/*', 'databaseSchemas');
    visitEntityDetailsPage(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.name,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.serviceName,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.entity
    );
    cy.get('[data-testid="breadcrumb"]')
      .contains(SCHEMA_AND_DATABASE_DISPLAY_NAME.schemaDisplayName)
      .click();
    verifyResponseStatusCode('@databaseSchemas', 200);
    updateDisplayName(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.schema,
      `/api/v1/databaseSchemas/*`
    );
  });

  it(`database`, () => {
    interceptURL('GET', 'api/v1/databases/name/*', 'database');
    visitEntityDetailsPage(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.name,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.serviceName,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.entity
    );
    cy.get('[data-testid="breadcrumb"]')
      .contains(SCHEMA_AND_DATABASE_DISPLAY_NAME.databaseDisplayName)
      .click();
    verifyResponseStatusCode('@database', 200);
    updateDisplayName(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.database,
      `/api/v1/databases/*`
    );
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
  });

  Object.entries(SERVICES).map(([serviceType, service]) => {
    it(`${service.type}`, () => {
      visitServiceDetailsPage(
        {
          type: service.type,
          name: service.name,
        },
        false
      );
      updateDisplayName(service.name, `/api/v1/services/${serviceType}/*`);
    });
  });
});
