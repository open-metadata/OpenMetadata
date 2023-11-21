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
  interceptURL('GET', `/api/v1/queries*`, 'getQueryData');

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
  cy.get('[data-testid="confirm-button"]').should('be.disabled');
  cy.get('[data-testid="confirmation-text-input"]').type('DEL{enter}');
  cy.get('#deleteTextInput_help').contains('Please type DELETE to confirm.');
  cy.get('[data-testid="confirm-button"]').should('be.disabled');
  cy.get('[data-testid="confirmation-text-input"]').clear().type('DELETE');
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
  cy.get('[data-testid="teams-subscription"] .cursor-pointer')
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
  cy.get('[data-testid="manage-dropdown-list-container"]').then(($body) => {
    const importButton = $body.find('[data-testid="import-button-title"]');

    expect(importButton.length).to.equal(0);
  });
  cy.get('[data-testid="manage-dropdown-list-container"]').then(($body) => {
    const exportButton = $body.find('[data-testid="export-title"]');

    expect(exportButton.length).to.equal(0);
  });
  cy.get('[data-testid="manage-dropdown-list-container"]').then(($body) => {
    const openGroupButton = $body.find('[data-testid="open-group-label"]');

    expect(openGroupButton.length).to.equal(0);
  });
  cy.get('[data-testid="restore-team-dropdown-title"]').should('be.visible');
  cy.get('[data-testid="delete-button-title"]').should('be.visible');
  cy.clickOutside();

  cy.get('[data-testid="team-details-collapse"]').then(($body) => {
    const editTeamButton = $body.find('[data-testid="edit-team-name"]');

    expect(editTeamButton.length).to.equal(0);
  });
  cy.get('[data-testid="team-details-collapse"]').then(($body) => {
    const addDomainButton = $body.find('[data-testid="add-domain"]');

    expect(addDomainButton.length).to.equal(0);
  });
  cy.get('[data-testid="team-details-collapse"]').then(($body) => {
    const editOwnerButton = $body.find('[data-testid="edit-owner"]');

    expect(editOwnerButton.length).to.equal(0);
  });
  cy.get('[data-testid="team-details-collapse"]').then(($body) => {
    const editEmailButton = $body.find('[data-testid="edit-email"]');

    expect(editEmailButton.length).to.equal(0);
  });
  cy.get('[data-testid="teams-subscription"]').then(($body) => {
    const teamSubscriptionEditButton = $body.find('.cursor-pointer');

    expect(teamSubscriptionEditButton.length).to.equal(0);
  });
  cy.get('[data-testid="team-details-collapse"]').then(($body) => {
    const editTeamTypeButton = $body.find(
      '[data-testid="edit-team-type-icon"]'
    );

    expect(editTeamTypeButton.length).to.equal(0);
  });
  cy.get('[data-testid="team-details-collapse"]').then(($body) => {
    const editDescription = $body.find('[data-testid="edit-description"]');

    expect(editDescription.length).to.equal(0);
  });

  cy.get('[data-testid="teams"]').scrollIntoView().click();
  cy.get('[data-testid=" team-details-container"]').then(($body) => {
    const editDescription = $body.find('[data-testid="add-team"]');

    expect(editDescription.length).to.equal(0);
  });
  cy.get('[data-testid="users"]').scrollIntoView().click();
  cy.get('[data-testid=" team-details-container"]').then(($body) => {
    const editDescription = $body.find('[data-testid="add-new-user"]');

    expect(editDescription.length).to.equal(0);
  });
  cy.get('[data-testid="roles"]').scrollIntoView().click();
  cy.get('[data-testid=" team-details-container"]').then(($body) => {
    const editDescription = $body.find('[data-testid="add-role"]');

    expect(editDescription.length).to.equal(0);
  });
  cy.get('[data-testid="policies"]').scrollIntoView().click();
  cy.get('[data-testid=" team-details-container"]').then(($body) => {
    const editDescription = $body.find('[data-testid="add-policy"]');

    expect(editDescription.length).to.equal(0);
  });
};
