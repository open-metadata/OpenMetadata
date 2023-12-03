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
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitDatabaseSchemaDetailsPage,
} from '../../common/common';
import { DELETE_TERM } from '../../constants/constants';
import {
  COMMON_PATCH_PAYLOAD,
  DATABASE_DETAILS_FOR_VERSION_TEST,
  DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST,
  DOMAIN_CREATION_DETAILS,
  OWNER,
  SERVICE_DETAILS_FOR_VERSION_TEST,
  TIER,
} from '../../constants/Version.constants';

const serviceDetails = SERVICE_DETAILS_FOR_VERSION_TEST.Database;

let domainId;

describe(`Database schema version page should work properly`, () => {
  let databaseId;
  let databaseSchemaId;
  let databaseSchemaFQN;

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      cy.request({
        method: 'PUT',
        url: `/api/v1/domains`,
        headers: { Authorization: `Bearer ${token}` },
        body: DOMAIN_CREATION_DETAILS,
      }).then((response) => {
        domainId = response.body.id;
      });

      // Create service
      cy.request({
        method: 'POST',
        url: `/api/v1/services/${serviceDetails.serviceCategory}`,
        headers: { Authorization: `Bearer ${token}` },
        body: serviceDetails.entityCreationDetails,
      });

      // Create Database
      cy.request({
        method: 'POST',
        url: `/api/v1/databases`,
        headers: { Authorization: `Bearer ${token}` },
        body: DATABASE_DETAILS_FOR_VERSION_TEST,
      }).then((response) => {
        databaseId = response.body.id;
      });

      // Create Database Schema
      cy.request({
        method: 'PUT',
        url: `/api/v1/databaseSchemas`,
        headers: { Authorization: `Bearer ${token}` },
        body: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST,
      }).then((response) => {
        databaseSchemaId = response.body.id;
        databaseSchemaFQN = response.body.fullyQualifiedName;

        cy.request({
          method: 'PATCH',
          url: `/api/v1/databaseSchemas/${databaseSchemaId}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: [
            ...COMMON_PATCH_PAYLOAD,
            {
              op: 'add',
              path: '/domain',
              value: {
                id: domainId,
                type: 'domain',
                name: DOMAIN_CREATION_DETAILS.name,
                description: DOMAIN_CREATION_DETAILS.description,
              },
            },
          ],
        });
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      cy.request({
        method: 'DELETE',
        url: `/api/v1/domains/name/${DOMAIN_CREATION_DETAILS.name}`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it(`Database Schema version page should show edited tags and description changes properly`, () => {
    visitDatabaseSchemaDetailsPage({
      settingsMenuId: serviceDetails.settingsMenuId,
      serviceCategory: serviceDetails.serviceCategory,
      serviceName: serviceDetails.serviceName,
      databaseRowKey: databaseId,
      databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
      databaseSchemaRowKey: databaseSchemaId,
      databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
    });

    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/name/${databaseSchemaFQN}*`,
      `getDatabaseSchemaDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="domain-link"] [data-testid="diff-added"]`)
      .scrollIntoView()
      .should('be.visible');

    cy.get(
      `[data-testid="asset-description-container"] [data-testid="diff-added"]`
    )
      .scrollIntoView()
      .should('be.visible');

    cy.get(
      `[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PersonalData.SpecialCategory"]`
    )
      .scrollIntoView()
      .should('be.visible');

    cy.get(
      `[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PII.Sensitive"]`
    )
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Database Schema version page should show owner changes properly`, () => {
    visitDatabaseSchemaDetailsPage({
      settingsMenuId: serviceDetails.settingsMenuId,
      serviceCategory: serviceDetails.serviceCategory,
      serviceName: serviceDetails.serviceName,
      databaseRowKey: databaseId,
      databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
      databaseSchemaRowKey: databaseSchemaId,
      databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
    });

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.2');

    addOwner(OWNER, `databaseSchemas`);

    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/name/${databaseSchemaFQN}*`,
      `getDatabaseSchemaDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.2').click();

    verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="owner-link"] > [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Database Schema version page should show tier changes properly`, () => {
    visitDatabaseSchemaDetailsPage({
      settingsMenuId: serviceDetails.settingsMenuId,
      serviceCategory: serviceDetails.serviceCategory,
      serviceName: serviceDetails.serviceName,
      databaseRowKey: databaseId,
      databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
      databaseSchemaRowKey: databaseSchemaId,
      databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
    });

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.2');

    addTier(TIER, `databaseSchemas`);

    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/name/${databaseSchemaFQN}*`,
      `getDatabaseSchemaDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.2').click();

    verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="Tier"] > [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Database  Schema version page should show version details after soft deleted`, () => {
    visitDatabaseSchemaDetailsPage({
      settingsMenuId: serviceDetails.settingsMenuId,
      serviceCategory: serviceDetails.serviceCategory,
      serviceName: serviceDetails.serviceName,
      databaseRowKey: databaseId,
      databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
      databaseSchemaRowKey: databaseSchemaId,
      databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
    });

    // Clicking on permanent delete radio button and checking the service name
    cy.get('[data-testid="manage-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-menu-id*="delete-button"]')
      .should('exist')
      .should('be.visible');
    cy.get('[data-testid="delete-button-title"]')
      .should('be.visible')
      .click()
      .as('deleteBtn');

    // Clicking on permanent delete radio button and checking the service name
    cy.get('[data-testid="soft-delete-option"]')
      .contains(DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL('DELETE', `/api/v1/databaseSchemas/*`, 'deleteSchema');

    cy.get('[data-testid="confirm-button"]').should('be.visible').click();

    verifyResponseStatusCode('@deleteSchema', 200);

    // Closing the toast notification
    toastNotification(`Database Schema deleted successfully!`);

    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/name/${databaseSchemaFQN}*`,
      `getDatabaseSchemaDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/${databaseSchemaId}/versions/0.3`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.3').click();

    verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    // Deleted badge should be visible
    cy.get('[data-testid="deleted-badge"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('@versionButton').click();

    cy.get('[data-testid="manage-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="restore-button-title"]').click();

    interceptURL('PUT', `/api/v1/databaseSchemas/restore`, 'restoreSchema');

    cy.get('.ant-modal-footer .ant-btn-primary').contains('Restore').click();

    verifyResponseStatusCode('@restoreSchema', 200);

    toastNotification(`Database Schema restored successfully`);

    cy.get('@versionButton').should('contain', '0.4');
  });

  it(`Cleanup for Database  Schema version page tests`, () => {
    visitDatabaseSchemaDetailsPage({
      settingsMenuId: serviceDetails.settingsMenuId,
      serviceCategory: serviceDetails.serviceCategory,
      serviceName: serviceDetails.serviceName,
      databaseRowKey: databaseId,
      databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
      databaseSchemaRowKey: databaseSchemaId,
      databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
    });

    // Clicking on permanent delete radio button and checking the service name
    cy.get('[data-testid="manage-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-menu-id*="delete-button"]')
      .should('exist')
      .should('be.visible');
    cy.get('[data-testid="delete-button-title"]')
      .should('be.visible')
      .click()
      .as('deleteBtn');

    // Clicking on permanent delete radio button and checking the service name
    cy.get('[data-testid="hard-delete-option"]')
      .contains(DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL('DELETE', `/api/v1/databaseSchemas/*`, 'deleteService');
    interceptURL(
      'GET',
      '/api/v1/services/*/name/*?fields=owner',
      'serviceDetails'
    );

    cy.get('[data-testid="confirm-button"]').should('be.visible').click();
    verifyResponseStatusCode('@deleteService', 200);

    // Closing the toast notification
    toastNotification(`Database Schema deleted successfully!`);

    cy.get(
      `[data-testid="service-name-${DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name}"]`
    ).should('not.exist');
  });
});
