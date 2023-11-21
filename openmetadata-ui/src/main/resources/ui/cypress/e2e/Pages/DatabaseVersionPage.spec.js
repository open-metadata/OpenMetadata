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
  visitServiceDetailsPage,
} from '../../common/common';
import { DELETE_TERM } from '../../constants/constants';
import {
  COMMON_PATCH_PAYLOAD,
  DATABASE_DETAILS_FOR_VERSION_TEST,
  DOMAIN_CREATION_DETAILS,
  OWNER,
  SERVICE_DETAILS_FOR_VERSION_TEST,
  TIER,
} from '../../constants/Version.constants';

const serviceDetails = SERVICE_DETAILS_FOR_VERSION_TEST.Database;

let domainId;

describe(`Database version page should work properly`, () => {
  let databaseId;
  let databaseFQN;

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
        databaseFQN = response.body.fullyQualifiedName;

        cy.request({
          method: 'PATCH',
          url: `/api/v1/databases/${databaseId}`,
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

  it(`Database version page should show edited tags and description changes properly`, () => {
    visitServiceDetailsPage(
      serviceDetails.settingsMenuId,
      serviceDetails.serviceCategory,
      serviceDetails.serviceName
    );

    cy.get(`[data-row-key="${databaseId}"]`)
      .contains(DATABASE_DETAILS_FOR_VERSION_TEST.name)
      .click();

    interceptURL(
      'GET',
      `/api/v1/databases/name/${databaseFQN}?include=non-deleted`,
      `getDatabaseDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/databases/${databaseId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/databases/${databaseId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode(`@getDatabaseDetails`, 200);
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

  it(`Database version page should show owner changes properly`, () => {
    visitServiceDetailsPage(
      serviceDetails.settingsMenuId,
      serviceDetails.serviceCategory,
      serviceDetails.serviceName
    );

    cy.get(`[data-row-key="${databaseId}"]`)
      .contains(DATABASE_DETAILS_FOR_VERSION_TEST.name)
      .click();

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.2');

    addOwner(OWNER, `databases`);

    interceptURL(
      'GET',
      `/api/v1/databases/name/${databaseFQN}?include=non-deleted`,
      `getDatabaseDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/databases/${databaseId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/databases/${databaseId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.2').click();

    verifyResponseStatusCode(`@getDatabaseDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="owner-link"] > [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Database version page should show tier changes properly`, () => {
    visitServiceDetailsPage(
      serviceDetails.settingsMenuId,
      serviceDetails.serviceCategory,
      serviceDetails.serviceName
    );

    cy.get(`[data-row-key="${databaseId}"]`)
      .contains(DATABASE_DETAILS_FOR_VERSION_TEST.name)
      .click();

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.2');

    addTier(TIER, `databases`);

    interceptURL(
      'GET',
      `/api/v1/databases/name/${databaseFQN}?include=non-deleted`,
      `getDatabaseDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/databases/${databaseId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/databases/${databaseId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.2').click();

    verifyResponseStatusCode(`@getDatabaseDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="Tier"] > [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Cleanup for Database version page tests`, () => {
    visitServiceDetailsPage(
      serviceDetails.settingsMenuId,
      serviceDetails.serviceCategory,
      serviceDetails.serviceName
    );

    cy.get(`[data-row-key="${databaseId}"]`)
      .contains(DATABASE_DETAILS_FOR_VERSION_TEST.name)
      .click();

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
      .contains(DATABASE_DETAILS_FOR_VERSION_TEST.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL('DELETE', `/api/v1/databases/*`, 'deleteService');
    interceptURL(
      'GET',
      '/api/v1/services/*/name/*?fields=owner',
      'serviceDetails'
    );

    cy.get('[data-testid="confirm-button"]').should('be.visible').click();
    verifyResponseStatusCode('@deleteService', 200);

    // Closing the toast notification
    toastNotification(`Database deleted successfully!`);

    cy.get(
      `[data-testid="service-name-${DATABASE_DETAILS_FOR_VERSION_TEST.name}"]`
    ).should('not.exist');
  });
});
