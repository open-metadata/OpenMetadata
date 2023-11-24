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
/// <reference types="cypress" />

import { DATA_ASSETS } from '../constants/constants';
import {
  CUSTOM_ATTRIBUTE_NAME,
  ENTITIES_WITHOUT_FOLLOWING_BUTTON,
  LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT,
  LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED,
} from '../constants/SoftDeleteFlow.constants';
import { interceptURL, verifyResponseStatusCode } from './common';

export const checkCustomPropertyEditButton = ({
  verifyAPIResponse = false,
  checkIsActionEnabled = true,
}) => {
  interceptURL(
    'GET',
    `/api/v1/metadata/types/name/*fields=customProperties*`,
    'getCustomProperties'
  );

  cy.get('[data-testid="custom_properties"]').click();
  if (verifyAPIResponse) {
    verifyResponseStatusCode('@getCustomProperties', 200);
  }

  if (checkIsActionEnabled) {
    cy.get(
      `[data-row-key="${CUSTOM_ATTRIBUTE_NAME}"] [data-testid="edit-icon"]`
    )
      .scrollIntoView()
      .should(`be.visible`);
  } else {
    cy.get(
      `[data-row-key="${CUSTOM_ATTRIBUTE_NAME}"] [data-testid="edit-icon"]`
    ).should(`not.exist`);
  }
};

export const checkForEditActions = ({
  entityType,
  entitySchemaName,
  verifyAPIResponse = false,
  checkIsActionEnabled = true,
}) => {
  LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED.filter(({ elementSelector }) => {
    if (elementSelector === '[data-testid="entity-follow-button"]') {
      return !ENTITIES_WITHOUT_FOLLOWING_BUTTON.includes(entityType);
    }

    return entityType !== 'services/databaseServices';
  }).map(({ containerSelector, elementSelector }) => {
    cy.get(`${containerSelector} ${elementSelector}`).should(
      `${checkIsActionEnabled ? 'not.' : ''}be.disabled`
    );
  });

  LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT.map(
    ({ containerSelector, elementSelector }) => {
      if (checkIsActionEnabled) {
        cy.get(`${containerSelector} ${elementSelector}`)
          .scrollIntoView()
          .should('be.visible');
      } else {
        cy.get(`${containerSelector} ${elementSelector}`).should('not.exist');
      }
    }
  );

  if (entitySchemaName) {
    checkCustomPropertyEditButton({ verifyAPIResponse, checkIsActionEnabled });
  }
};

export const checkLineageTabActions = ({
  verifyAPIResponse = false,
  checkIsActionEnabled = true,
}) => {
  interceptURL(
    'GET',
    `/api/v1/lineage/*/name/*?upstreamDepth=1&downstreamDepth=1*`,
    'getLineageData'
  );

  cy.get('[data-testid="lineage"]').click();

  if (verifyAPIResponse) {
    verifyResponseStatusCode('@getLineageData', 200);
  }

  if (checkIsActionEnabled) {
    cy.get('[data-testid="edit-lineage"]').should('be.visible');
  } else {
    cy.get('[data-testid="no-data-placeholder"]').should(
      'contain',
      'Lineage data is not available for deleted entities.'
    );
  }
};

export const checkForTableSpecificFields = ({
  verifyAPIResponse = false,
  checkIsActionEnabled = true,
}) => {
  interceptURL('GET', `/api/v1/queries*`, 'getQueryData');

  cy.get('[data-testid="table_queries"]').click();

  if (verifyAPIResponse) {
    verifyResponseStatusCode('@getQueryData', 200);
  }

  if (checkIsActionEnabled) {
    cy.get('[data-testid="add-query-btn"]').should('be.enabled');
  } else {
    cy.get('[data-testid="no-data-placeholder"]').should(
      'contain',
      'Queries data is not available for deleted entities.'
    );
  }

  interceptURL('GET', `/api/v1/tables/*/systemProfile*`, 'getSystemProfile');

  cy.get('[data-testid="profiler"]').click();

  verifyResponseStatusCode('@getSystemProfile', 200);

  cy.get('[data-testid="profiler-add-table-test-btn"]').should(
    checkIsActionEnabled ? 'be.visible' : 'not.exist'
  );
  cy.get('[data-testid="profiler-setting-btn"]').should(
    checkIsActionEnabled ? 'be.visible' : 'not.exist'
  );
};

export const softDeletedEntityCommonChecks = ({
  entityType,
  firstTabKey,
  entitySchemaName,
  isLineageTabPresent,
}) => {
  const isTableEntity = entityType === DATA_ASSETS.tables;

  // Check if all the edit actions are available for the entity
  checkForEditActions({
    entityType,
    entitySchemaName,
    verifyAPIResponse: true,
  });

  if (isLineageTabPresent) {
    checkLineageTabActions({ verifyAPIResponse: true });
  }

  if (isTableEntity) {
    checkForTableSpecificFields({ verifyAPIResponse: true });
  }

  // Soft delete the entity
  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="delete-button-title"]').click();
  cy.get('[data-testid="confirm-button"]').should('be.disabled');
  cy.get('[data-testid="confirmation-text-input"]').type('DEL{enter}');
  cy.get('#deleteTextInput_help').should(
    'contain',
    'Please type DELETE to confirm.'
  );
  cy.get('[data-testid="confirm-button"]').should('be.disabled');
  cy.get('[data-testid="confirmation-text-input"]').clear().type('DELETE');
  cy.get('[data-testid="confirm-button"]').click();
  cy.get('.Toastify__close-button').click();
  cy.get('[data-testid="deleted-badge"]').should('be.visible');

  // Check if all the edit actions are disabled or removed for soft deleted entity
  cy.get(`[data-testid="${firstTabKey}"]`).click();

  checkForEditActions({
    entityType,
    entitySchemaName,
    checkIsActionEnabled: false,
  });

  if (isLineageTabPresent) {
    checkLineageTabActions({ checkIsActionEnabled: false });
  }

  if (isTableEntity) {
    checkForTableSpecificFields({ checkIsActionEnabled: false });
  }

  cy.get('[data-testid="manage-button"]').click();

  // only two menu options (restore and delete) should be present
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="announcement-button"]'
  ).should('not.exist');
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
  ).should('not.exist');
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="profiler-setting-button"]'
  ).should('not.exist');
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="restore-button"]'
  ).should('be.visible');
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="delete-button"]'
  ).should('be.visible');

  // Restore the soft deleted entity
  cy.get('[data-testid="restore-button-title"]').click();

  interceptURL(
    'PUT',
    entityType === 'dashboardDataModel' ||
      entityType === 'services/databaseServices'
      ? '/api/v1/*/*/restore'
      : `/api/v1/*/restore`,
    'restoreEntity'
  );

  cy.get('.ant-modal-footer .ant-btn-primary').contains('Restore').click();

  verifyResponseStatusCode('@restoreEntity', 200);

  // Check if all the edit actions are available for the restored entity
  cy.get(`[data-testid="${firstTabKey}"]`).click();

  checkForEditActions({ entityType, entitySchemaName });

  if (isLineageTabPresent) {
    checkLineageTabActions({ verifyAPIResponse: true });
  }

  if (isTableEntity) {
    checkForTableSpecificFields({ verifyAPIResponse: true });
  }
};

export const nonDeletedTeamChecks = () => {
  cy.get('[data-testid="manage-button"]').scrollIntoView().click();
  cy.get('[data-testid="import-button-title"]').should('be.visible');
  cy.get('[data-testid="export-title"]').should('be.visible');
  cy.get('[data-testid="open-group-label"]').should('be.visible');
  cy.get('[data-testid="delete-button-title"]').should('be.visible');
  cy.clickOutside();

  cy.get('[data-testid="edit-team-name"]')
    .scrollIntoView()
    .should('be.visible');
  cy.get('[data-testid="add-domain"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="edit-owner"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="edit-email"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="edit-team-subscription"]')
    .scrollIntoView()
    .should('be.visible');
  cy.get('[data-testid="edit-team-type-icon"]')
    .scrollIntoView()
    .should('be.visible');
  cy.get('[data-testid="edit-description"]')
    .scrollIntoView()
    .should('be.visible');

  cy.get('[data-testid="teams"]').scrollIntoView().click();
  cy.get('[data-testid="add-team"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="users"]').scrollIntoView().click();
  cy.get('[data-testid="add-new-user"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="roles"]').scrollIntoView().click();
  cy.get('[data-testid="add-role"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="policies"]').scrollIntoView().click();
  cy.get('[data-testid="add-policy"]').scrollIntoView().should('be.visible');
};

export const deletedTeamChecks = () => {
  cy.get('[data-testid="manage-button"]').scrollIntoView().click();
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="import-button-title"]'
  ).should('not.exist');
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="export-title"]'
  ).should('not.exist');
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="open-group-label"]'
  ).should('not.exist');
  cy.get('[data-testid="restore-team-dropdown-title"]').should('be.visible');
  cy.get('[data-testid="delete-button-title"]').should('be.visible');
  cy.clickOutside();

  cy.get('[data-testid="edit-team-name"]').should('not.exist');
  cy.get('[data-testid="add-domain"]').should('not.exist');
  cy.get('[data-testid="edit-owner"]').should('not.exist');
  cy.get('[data-testid="edit-email"]').should('not.exist');
  cy.get('[data-testid="edit-team-subscription"]').should('not.exist');
  cy.get('[data-testid="edit-team-type-icon"]').should('not.exist');
  cy.get('[data-testid="edit-description"]').should('not.exist');

  cy.get('[data-testid="teams"]').scrollIntoView().click();
  cy.get(
    '[data-testid=" team-details-container"] [data-testid="add-team"]'
  ).should('not.exist');
  cy.get('[data-testid="users"]').scrollIntoView().click();
  cy.get(
    '[data-testid=" team-details-container"] [data-testid="add-new-user"]'
  ).should('not.exist');
  cy.get('[data-testid="roles"]').scrollIntoView().click();
  cy.get(
    '[data-testid=" team-details-container"] [data-testid="add-role"]'
  ).should('not.exist');
  cy.get('[data-testid="policies"]').scrollIntoView().click();
  cy.get(
    '[data-testid=" team-details-container"] [data-testid="add-policy"]'
  ).should('not.exist');
};
