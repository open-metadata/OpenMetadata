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
  visitDataModelPage,
} from '../../common/common';
import { visitDataModelVersionPage } from '../../common/VersionUtils';
import { DELETE_TERM } from '../../constants/constants';
import {
  DATA_MODEL_DETAILS,
  DATA_MODEL_DETAILS_FOR_VERSION_TEST,
  DATA_MODEL_PATCH_PAYLOAD,
  OWNER,
  TIER,
} from '../../constants/Version.constants';

describe('Data model version page should work properly', () => {
  const dataModelName = DATA_MODEL_DETAILS.name;
  let dataModelId;
  let dataModelFQN;

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      cy.request({
        method: 'PUT',
        url: `/api/v1/dashboard/datamodels`,
        headers: { Authorization: `Bearer ${token}` },
        body: DATA_MODEL_DETAILS_FOR_VERSION_TEST,
      }).then((response) => {
        dataModelId = response.body.id;
        dataModelFQN = response.body.fullyQualifiedName;

        cy.request({
          method: 'PATCH',
          url: `/api/v1/dashboard/datamodels/${dataModelId}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: DATA_MODEL_PATCH_PAYLOAD,
        });
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it('Data model version page should show description and tag changes properly', () => {
    visitDataModelVersionPage(dataModelFQN, dataModelId, dataModelName, '0.2');

    cy.get(
      `[data-testid="asset-description-container"] [data-testid="diff-added"]`
    ).should('be.visible');

    cy.get(
      `[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PersonalData.SpecialCategory"]`
    )
      .scrollIntoView()
      .should('be.visible');

    cy.get(
      `[data-row-key="${DATA_MODEL_DETAILS.updatedTagEntityChildName}"] .diff-added [data-testid="tag-PersonalData.Personal"]`
    )
      .scrollIntoView()
      .should('be.visible');

    cy.get(
      `[data-row-key="${DATA_MODEL_DETAILS.updatedTagEntityChildName}"] .diff-added [data-testid="tag-PII.Sensitive"]`
    )
      .scrollIntoView()
      .should('be.visible');

    cy.get(`[data-row-key="column_2"] [data-testid="diff-removed"]`)
      .scrollIntoView()
      .should('be.visible');

    cy.get(`[data-row-key="column_3"] [data-testid="diff-added"]`)
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Data model version page should show owner changes properly`, () => {
    visitDataModelPage(dataModelFQN, dataModelName);

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.2');

    addOwner(OWNER, 'dashboard/datamodels');

    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/name/${dataModelFQN}*`,
      `getDataModelDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.2').click();

    verifyResponseStatusCode(`@getDataModelDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="owner-link"] > [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Data model version page should show tier changes properly`, () => {
    visitDataModelPage(dataModelFQN, dataModelName);

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.2');

    addTier(TIER, 'dashboard/datamodels');

    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/name/${dataModelFQN}*`,
      `getDataModelDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.2').click();

    verifyResponseStatusCode(`@getDataModelDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="Tier"] > [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Data model version page should show version details after soft deleted', () => {
    visitDataModelPage(dataModelFQN, dataModelName);

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
      .contains(DATA_MODEL_DETAILS.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);

    interceptURL('DELETE', `/api/v1/dashboard/datamodels/*`, 'deleteDataModel');

    cy.get('[data-testid="confirm-button"]').should('be.visible').click();

    verifyResponseStatusCode('@deleteDataModel', 200);

    // Closing the toast notification
    toastNotification(`Dashboard Data Model deleted successfully!`);

    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/name/${dataModelFQN}*`,
      `getDataModelDetails`
    );
    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions`,
      'getVersionsList'
    );
    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions/0.3`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.3').click();

    verifyResponseStatusCode(`@getDataModelDetails`, 200);
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

    interceptURL(
      'PUT',
      `/api/v1/dashboard/datamodels/restore`,
      'restoreDataModel'
    );

    cy.get('.ant-modal-footer .ant-btn-primary').contains('Restore').click();

    verifyResponseStatusCode('@restoreDataModel', 200);

    toastNotification(`Data Model restored successfully`);

    cy.get('@versionButton').should('contain', '0.4');
  });

  it(`Cleanup for data model version page test`, () => {
    visitDataModelPage(dataModelFQN, dataModelName);

    cy.get('[data-testid="manage-button"]').click();

    cy.get('[data-testid="delete-button-title"]').click();

    cy.get('.ant-modal-header').should('contain', `Delete ${dataModelName}`);

    cy.get(`[data-testid="hard-delete-option"]`).click();

    cy.get('[data-testid="confirm-button"]').should('be.disabled');
    cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

    interceptURL(
      'DELETE',
      `api/v1/dashboard/datamodels/*?hardDelete=true&recursive=false`,
      `hardDeleteTable`
    );
    cy.get('[data-testid="confirm-button"]').should('not.be.disabled');
    cy.get('[data-testid="confirm-button"]').click();
    verifyResponseStatusCode(`@hardDeleteTable`, 200);

    toastNotification(`Dashboard Data Model deleted successfully!`, false);
  });
});
