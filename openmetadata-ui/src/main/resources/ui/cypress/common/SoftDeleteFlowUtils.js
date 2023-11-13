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

// / <reference types="cypress" />

import { DATA_ASSETS } from '../constants/constants';
import {
  CUSTOM_ATTRIBUTE_NAME,
  ENTITIES_WITHOUT_FOLLOWING_BUTTON,
  LIST_OF_ENTITIES_WITH_DATA_PRODUCT,
  LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT,
  LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED,
} from '../constants/SoftDeleteFlow.constants';
import { interceptURL, verifyResponseStatusCode } from './common';

export const checkIsEditButtonNotAvailable = ({
  containerSelector,
  elementSelector,
}) => {
  cy.get(containerSelector).then(($body) => {
    const editField = $body.find(elementSelector);

    expect(editField.length).to.equal(0);
  });
};

export const checkCustomPropertyEditButton = (
  verifyAPIResponse = false,
  checkIsActionEnabled = true
) => {
  interceptURL(
    'GET',
    `/api/v1/metadata/types/name/*fields=customProperties`,
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
    cy.get(`[data-row-key="${CUSTOM_ATTRIBUTE_NAME}"]`).then(($body) => {
      const editField = $body.find('[data-testid="edit-icon"]');

      expect(editField.length).to.equal(0);
    });
  }
};

const checkForEditActions = (
  entityType,
  entitySchemaName,
  verifyAPIResponse = false,
  checkIsActionEnabled = true
) => {
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
      // Check if the the entities have data products for testing data product edit actions
      const shouldRunCheck = containerSelector.includes('data-products-list')
        ? LIST_OF_ENTITIES_WITH_DATA_PRODUCT.includes(entityType)
        : true;

      if (shouldRunCheck) {
        if (checkIsActionEnabled) {
          cy.get(`${containerSelector} ${elementSelector}`)
            .scrollIntoView()
            .should('be.visible');
        } else {
          checkIsEditButtonNotAvailable({
            containerSelector,
            elementSelector,
          });
        }
      }
    }
  );

  if (entitySchemaName) {
    checkCustomPropertyEditButton(verifyAPIResponse, checkIsActionEnabled);
  }
};

const checkLineageTabActions = (
  verifyAPIResponse = false,
  checkIsActionEnabled = true
) => {
  interceptURL(
    'GET',
    `/api/v1/lineage/*/name/*?upstreamDepth=1&downstreamDepth=1`,
    'getLineageData'
  );

  cy.get('[data-testid="lineage"]').click();

  if (verifyAPIResponse) {
    verifyResponseStatusCode('@getLineageData', 200);
  }

  if (checkIsActionEnabled) {
    cy.get('[data-testid="edit-lineage"]').should('be.visible');
  } else {
    cy.get('[data-testid="no-data-placeholder"]').contains(
      'Lineage data is not available for deleted entities.'
    );
  }
};

const checkForTableSpecificFields = (
  verifyAPIResponse = false,
  checkIsActionEnabled = true
) => {
  interceptURL('GET', `/api/v1/queries?limit=10&entityId=*`, 'getQueryData');

  cy.get('[data-testid="table_queries"]').click();

  if (verifyAPIResponse) {
    verifyResponseStatusCode('@getQueryData', 200);
  }

  if (checkIsActionEnabled) {
    cy.get('[data-testid="add-query-btn"]').should('be.enabled');
  } else {
    cy.get('[data-testid="no-data-placeholder"]').contains(
      'Queries data is not available for deleted entities.'
    );
  }

  interceptURL('GET', `/api/v1/tables/*/systemProfile*`, 'getSystemProfile');

  cy.get('[data-testid="profiler"]').click();

  verifyResponseStatusCode('@getSystemProfile', 200);

  if (checkIsActionEnabled) {
    cy.get('[data-testid="profiler-add-table-test-btn"]').should('be.visible');
    cy.get('[data-testid="profiler-setting-btn"]').should('be.visible');
  } else {
    cy.get('[data-testid="table-profiler-container"]').then(($body) => {
      const addTestButton = $body.find(
        '[data-testid="profiler-add-table-test-btn"]'
      );
      const settingsButton = $body.find('[data-testid="profiler-setting-btn"]');

      expect(addTestButton.length).to.equal(0);
      expect(settingsButton.length).to.equal(0);
    });
  }
};

export const softDeletedEntityCommonChecks = ({
  entityType,
  firstTabKey,
  entitySchemaName,
  isLineageTabPresent,
}) => {
  const isTableEntity = entityType === DATA_ASSETS.tables;

  checkForEditActions(entityType, entitySchemaName, true);

  if (isLineageTabPresent) {
    checkLineageTabActions(true);
  }

  if (isTableEntity) {
    checkForTableSpecificFields(true);
  }

  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="delete-button-title"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
  cy.get('[data-testid="confirm-button"]').click();
  cy.get('.Toastify__close-button').click();
  cy.get('[data-testid="deleted-badge"]').should('be.visible');

  cy.get(`[data-testid="${firstTabKey}"]`).click();

  checkForEditActions(entityType, entitySchemaName, false, false);

  if (isLineageTabPresent) {
    checkLineageTabActions(false, false);
  }

  if (isTableEntity) {
    checkForTableSpecificFields(false, false);
  }

  cy.get('[data-testid="manage-button"]').click();

  // only two menu options (restore and delete) should be present
  cy.get('[data-testid="manage-dropdown-list-container"]').then(($body) => {
    const editTier = $body.find(`[data-menu-id*="rc-menu"]`);

    expect(editTier.length).to.equal(2);
  });
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="restore-button"]'
  );
  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="delete-button"]'
  );

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

  cy.get(`[data-testid="${firstTabKey}"]`).click();

  checkForEditActions(entityType, entitySchemaName);

  if (isLineageTabPresent) {
    checkLineageTabActions(true);
  }

  if (isTableEntity) {
    checkForTableSpecificFields(true);
  }
};
