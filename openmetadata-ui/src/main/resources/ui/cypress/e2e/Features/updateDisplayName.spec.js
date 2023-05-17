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
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  createDataWithApi,
  visitServiceDetailsPage,
} from '../../common/serviceUtils';
import { MYDATA_SUMMARY_OPTIONS } from '../../constants/constants';
import {
  DASHBOARD_SERVICE_API,
  DATABASE_SERVICE_API,
  DELETE_SERVICES,
  ENTITIES_DISPLAY_NAME,
  MESSAGING_SERVICE_API,
  ML_MODAL_SERVICE_API,
  PIPELINE_SERVICE_API,
  SCHEMA_AND_DATABASE_DISPLAY_NAME,
  SERVICES,
  STORAGE_SERVICE_API,
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
  cy.get('[data-testid="save-button"]').should('be.visible').click();
  cy.get('.ant-modal-body').should('contain', 'Display Name is required');
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

describe('Update DisplayName', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Preparing data', () => {
    const token = localStorage.getItem('oidcIdToken');
    createDataWithApi(DATABASE_SERVICE_API, token);
    createDataWithApi(MESSAGING_SERVICE_API, token);
    createDataWithApi(DASHBOARD_SERVICE_API, token);
    createDataWithApi(PIPELINE_SERVICE_API, token);
    createDataWithApi(ML_MODAL_SERVICE_API, token);
    createDataWithApi(STORAGE_SERVICE_API, token);
  });

  Object.values(ENTITIES_DISPLAY_NAME).map((entity) => {
    it(`of ${entity.entity}`, () => {
      visitEntityDetailsPage(entity.name, entity.serviceName, entity.entity);
      updateDisplayName(entity.displayName, `/api/v1/${entity.entity}/*`);
    });
  });

  it(`of databaseSchema`, () => {
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
  });

  it(`of database`, () => {
    interceptURL('GET', 'api/v1/databases/name/*', 'database');
    visitEntityDetailsPage(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.name,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.serviceName,
      SCHEMA_AND_DATABASE_DISPLAY_NAME.entity
    );
    cy.get('[data-testid="breadcrumb"]')
      .contains(SCHEMA_AND_DATABASE_DISPLAY_NAME.database)
      .click();
    verifyResponseStatusCode('@database', 200);
    updateDisplayName(
      SCHEMA_AND_DATABASE_DISPLAY_NAME.databaseDisplayName,
      `/api/v1/databases/*`
    );
  });

  Object.entries(SERVICES).map(([serviceType, service]) => {
    it(`of ${service.type}`, () => {
      visitServiceDetailsPage(service);
      updateDisplayName(
        service.displayName,
        `/api/v1/services/${serviceType}/*`
      );
    });
  });
});

describe('Verify updated displayName in breadcrumb', () => {
  beforeEach(() => {
    cy.login();
  });

  Object.values(ENTITIES_DISPLAY_NAME).map((entity) => {
    it(`of ${entity.entity}`, () => {
      if (entity.entity === MYDATA_SUMMARY_OPTIONS.dashboards) {
        visitEntityDetailsPage(
          entity.displayName,
          entity.serviceName,
          entity.entity
        );
      } else {
        visitEntityDetailsPage(entity.name, entity.serviceName, entity.entity);
      }
      entity.breadcrumb.map((value) => {
        cy.get('[data-testid="breadcrumb"]').should('contain', value);
      });
    });
  });

  it(`of databaseSchema`, () => {
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
    SCHEMA_AND_DATABASE_DISPLAY_NAME.schemaBreadcrumb.map((value) => {
      cy.get('[data-testid="breadcrumb"]').should('contain', value);
    });
  });

  it(`of database`, () => {
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
    SCHEMA_AND_DATABASE_DISPLAY_NAME.databaseBreadcrumb.map((value) => {
      cy.get('[data-testid="breadcrumb"]').should('contain', value);
    });
  });
});

describe('Cleanup', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Cleaning data', () => {
    const token = localStorage.getItem('oidcIdToken');

    DELETE_SERVICES.map((service) => {
      cy.request({
        method: 'GET',
        url: `/api/v1/services/${service.type}/name/${service.name}`,
        auth: {
          bearer: token,
        },
      }).then((response) => {
        const id = response.body.id;
        cy.request({
          method: 'DELETE',
          url: `/api/v1/services/${service.type}/${id}`,
          qs: {
            hardDelete: true,
            recursive: true,
          },
          auth: {
            bearer: token,
          },
        });
      });
    });
  });
});
