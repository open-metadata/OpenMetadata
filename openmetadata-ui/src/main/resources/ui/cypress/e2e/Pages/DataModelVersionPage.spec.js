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
  removeOwner,
  removeTier,
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

  beforeEach(() => {
    cy.login();
  });

  it('Prerequisite for data model version page tests', () => {
    const token = localStorage.getItem('oidcIdToken');

    cy.request({
      method: 'PUT',
      url: `/api/v1/dashboard/datamodels`,
      headers: { Authorization: `Bearer ${token}` },
      body: DATA_MODEL_DETAILS_FOR_VERSION_TEST,
    }).then((response) => {
      expect(response.status).to.eq(201);

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
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
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

  it(`Data model version page should show removed tags changes properly`, () => {
    visitDataModelPage(dataModelFQN, dataModelName);

    cy.get(
      '[data-testid="entity-right-panel"]  [data-testid="edit-button"]'
    ).click();

    cy.get(
      '[data-testid="selected-tag-PersonalData.SpecialCategory"] [data-testid="remove-tags"]'
    ).click();

    interceptURL(
      'PATCH',
      `/api/v1/dashboard/datamodels/${dataModelId}`,
      `patchDataModel`
    );

    cy.get('[data-testid="saveAssociatedTag"]').click();

    verifyResponseStatusCode(`@patchDataModel`, 200);

    cy.get('[data-testid="version-button"]').contains('0.3').click();

    cy.get(
      `[data-testid="entity-right-panel"] .diff-removed [data-testid="tag-PersonalData.SpecialCategory"]`
    )
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Data model version page should show owner changes properly`, () => {
    visitDataModelPage(dataModelFQN, dataModelName);

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.3');

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
      `/api/v1/dashboard/datamodels/${dataModelId}/versions/0.4`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.4').click();

    verifyResponseStatusCode(`@getDataModelDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-added"]`).scrollIntoView().should('be.visible');

    cy.get('@versionButton').contains('0.4').click();

    removeOwner('dashboard/datamodels');

    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions/0.5`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.5').click();

    verifyResponseStatusCode(`@getDataModelDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-removed"]`)
      .scrollIntoView()
      .should('be.visible');
  });

  it(`Data model version page should show tier changes properly`, () => {
    visitDataModelPage(dataModelFQN, dataModelName);

    cy.get('[data-testid="version-button"]').as('versionButton');

    cy.get('@versionButton').contains('0.5');

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
      `/api/v1/dashboard/datamodels/${dataModelId}/versions/0.6`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.6').click();

    verifyResponseStatusCode(`@getDataModelDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-added"]`).scrollIntoView().should('be.visible');

    cy.get('@versionButton').contains('0.6').click();

    removeTier('dashboard/datamodels');

    interceptURL(
      'GET',
      `/api/v1/dashboard/datamodels/${dataModelId}/versions/0.7`,
      'getSelectedVersionDetails'
    );

    cy.get('@versionButton').contains('0.7').click();

    verifyResponseStatusCode(`@getDataModelDetails`, 200);
    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get(`[data-testid="diff-removed"]`)
      .scrollIntoView()
      .should('be.visible');
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
