/*
 *  Copyright 2022 Collate.
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

import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../../common/common';
import { getToken } from '../../common/Utils/LocalStorage';
import { DELETE_TERM } from '../../constants/constants';
import { PERSONA_DETAILS, USER_DETAILS } from '../../constants/EntityConstant';
import { GlobalSettingOptions } from '../../constants/settings.constant';

const updatePersonaDisplayName = (displayName) => {
  interceptURL('PATCH', `/api/v1/personas/*`, 'updatePersona');

  cy.get('[data-testid="manage-button"]').click();

  cy.get(
    '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
  ).click();

  cy.get('#name').should('be.disabled');
  cy.get('#displayName').should('not.be.disabled').clear();

  cy.get('#displayName').type(displayName);

  cy.get('[data-testid="save-button"]').click();
  verifyResponseStatusCode('@updatePersona', 200);
};

describe('Persona operations', { tags: 'Settings' }, () => {
  const user = {};
  const userSearchText = `${USER_DETAILS.firstName}${USER_DETAILS.lastName}`;
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      // Create a new user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: USER_DETAILS,
      }).then((response) => {
        user.details = response.body;
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${user.details.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  beforeEach(() => {
    cy.login();

    interceptURL('GET', '/api/v1/personas*', 'getPersonas');

    cy.settingClick(GlobalSettingOptions.PERSONA);

    verifyResponseStatusCode('@getPersonas', 200);
  });

  it('Persona creation should work properly', () => {
    cy.get('[data-testid="add-persona-button"]').scrollIntoView().click();
    cy.get('[data-testid="name"]').clear().type(PERSONA_DETAILS.name);
    cy.get('[data-testid="displayName"]')
      .clear()
      .type(PERSONA_DETAILS.displayName);
    cy.get(descriptionBox).type(PERSONA_DETAILS.description);
    cy.get('[data-testid="add-users"]').scrollIntoView().click();

    cy.get('[data-testid="searchbar"]').type(userSearchText);

    cy.get(`.ant-popover [title="${userSearchText}"]`).click();
    cy.get('[data-testid="selectable-list-update-btn"]')
      .scrollIntoView()
      .click();

    interceptURL('POST', '/api/v1/personas', 'createPersona');

    cy.get('.ant-modal-footer > .ant-btn-primary')
      .contains('Create')
      .scrollIntoView()
      .click();

    verifyResponseStatusCode('@createPersona', 201);

    // Verify created persona details

    cy.get('[data-testid="persona-details-card"] .ant-card-meta-title').should(
      'contain',
      PERSONA_DETAILS.displayName
    );
    cy.get(
      '[data-testid="persona-details-card"] .ant-card-meta-description'
    ).should('contain', PERSONA_DETAILS.description);

    interceptURL(
      'GET',
      `/api/v1/personas/name/${PERSONA_DETAILS.name}*`,
      'getPersonaDetails'
    );

    cy.get('[data-testid="persona-details-card"]')
      .contains(PERSONA_DETAILS.displayName)
      .scrollIntoView()
      .click();

    verifyResponseStatusCode('@getPersonaDetails', 200);

    cy.get(
      '[data-testid="page-header-container"] [data-testid="heading"]'
    ).should('contain', PERSONA_DETAILS.displayName);
    cy.get(
      '[data-testid="page-header-container"] [data-testid="sub-heading"]'
    ).should('contain', PERSONA_DETAILS.name);
    cy.get(
      '[data-testid="viewer-container"] [data-testid="markdown-parser"]'
    ).should('contain', PERSONA_DETAILS.description);

    cy.get(
      `[data-row-key="${user.details.name}"] [data-testid="${user.details.name}"]`
    ).should('contain', user.details.name);
  });

  it('Persona update description flow should work properly', () => {
    interceptURL(
      'GET',
      `/api/v1/personas/name/${PERSONA_DETAILS.name}*`,
      'getPersonaDetails'
    );

    cy.get('[data-testid="persona-details-card"]')
      .contains(PERSONA_DETAILS.displayName)
      .scrollIntoView()
      .click();

    verifyResponseStatusCode('@getPersonaDetails', 200);

    cy.get('[data-testid="edit-description"]').click();

    cy.get(`[data-testid="markdown-editor"] ${descriptionBox}`)
      .clear()
      .type('Updated description.');

    interceptURL('PATCH', `/api/v1/personas/*`, 'updatePersona');

    cy.get(`[data-testid="markdown-editor"] [data-testid="save"]`).click();

    verifyResponseStatusCode('@updatePersona', 200);

    cy.get(
      `[data-testid="viewer-container"] [data-testid="markdown-parser"]`
    ).should('contain', 'Updated description.');
  });

  it('Persona rename flow should work properly', () => {
    interceptURL(
      'GET',
      `/api/v1/personas/name/${PERSONA_DETAILS.name}*`,
      'getPersonaDetails'
    );

    cy.get('[data-testid="persona-details-card"]')
      .contains(PERSONA_DETAILS.displayName)
      .scrollIntoView()
      .click();

    verifyResponseStatusCode('@getPersonaDetails', 200);

    updatePersonaDisplayName('Test Persona');

    cy.get('[data-testid="heading"]').should('contain', 'Test Persona');

    updatePersonaDisplayName(PERSONA_DETAILS.displayName);

    cy.get('[data-testid="heading"]').should(
      'contain',
      PERSONA_DETAILS.displayName
    );
  });

  it('Remove users in persona should work properly', () => {
    // Remove user from the users tab
    interceptURL(
      'GET',
      `/api/v1/personas/name/${PERSONA_DETAILS.name}*`,
      'getPersonaDetails'
    );

    cy.get('[data-testid="persona-details-card"]')
      .contains(PERSONA_DETAILS.displayName)
      .scrollIntoView()
      .click();

    verifyResponseStatusCode('@getPersonaDetails', 200);

    cy.get(
      `[data-row-key="${user.details.name}"] [data-testid="remove-user-btn"]`
    ).click();

    cy.get('[data-testid="remove-confirmation-modal"]').should(
      'contain',
      `Are you sure you want to remove ${user.details.name}?`
    );

    interceptURL('PATCH', `/api/v1/personas/*`, 'updatePersona');

    cy.get('[data-testid="remove-confirmation-modal"]')
      .contains('Confirm')
      .click();

    verifyResponseStatusCode('@updatePersona', 200);
  });

  it('Delete persona should work properly', () => {
    interceptURL(
      'GET',
      `/api/v1/personas/name/${PERSONA_DETAILS.name}*`,
      'getPersonaDetails'
    );

    cy.get('[data-testid="persona-details-card"]')
      .contains(PERSONA_DETAILS.displayName)
      .scrollIntoView()
      .click();

    verifyResponseStatusCode('@getPersonaDetails', 200);

    cy.get('[data-testid="manage-button"]').click();

    cy.get('[data-testid="delete-button-title"]').click();

    cy.get('.ant-modal-header').should('contain', PERSONA_DETAILS.displayName);

    cy.get(`[data-testid="hard-delete-option"]`).click();

    cy.get('[data-testid="confirm-button"]').should('be.disabled');
    cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

    interceptURL(
      'DELETE',
      `/api/v1/personas/*?hardDelete=true&recursive=false`,
      `deletePersona`
    );
    cy.get('[data-testid="confirm-button"]').should('not.be.disabled');
    cy.get('[data-testid="confirm-button"]').click();
    verifyResponseStatusCode(`@deletePersona`, 200);

    toastNotification(`"${PERSONA_DETAILS.displayName}" deleted successfully!`);
  });
});
