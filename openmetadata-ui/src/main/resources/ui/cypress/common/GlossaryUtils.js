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

import { DELETE_TERM } from '../constants/constants';
import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from './common';

export const visitGlossaryPage = () => {
  interceptURL('GET', '/api/v1/glossaries?fields=*', 'getGlossaries');

  cy.get('[data-testid="governance"]').click({
    animationDistanceThreshold: 20,
    waitForAnimations: true,
  });

  // Applying force true as the hover over tooltip
  cy.get('[data-testid="app-bar-item-glossary"]').click({ force: true });

  verifyResponseStatusCode('@getGlossaries', 200);
};

export const addReviewer = (reviewerName, entity) => {
  interceptURL('GET', '/api/v1/users?limit=25&isBot=false', 'getUsers');

  cy.get('[data-testid="glossary-reviewer"] [data-testid="Add"]').click();

  verifyResponseStatusCode('@getUsers', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(reviewerName)}*`,
    'searchOwner'
  );

  cy.get('[data-testid="searchbar"]').type(reviewerName);

  verifyResponseStatusCode('@searchOwner', 200);

  interceptURL('PATCH', `/api/v1/${entity}/*`, 'patchOwner');

  cy.get(`.ant-popover [title="${reviewerName}"]`).click();

  cy.get('[data-testid="selectable-list-update-btn"]').click();

  verifyResponseStatusCode('@patchOwner', 200);

  cy.get('[data-testid="glossary-reviewer"]').should('contain', reviewerName);
};

export const removeReviewer = (entity) => {
  interceptURL('PATCH', `/api/v1/${entity}/*`, 'patchOwner');

  cy.get('[data-testid="edit-reviewer-button"]').click();

  cy.get('[data-testid="clear-all-button"]').click();

  cy.get('[data-testid="selectable-list-update-btn"]').click();

  verifyResponseStatusCode('@patchOwner', 200);

  cy.get('[data-testid="glossary-reviewer"] [data-testid="Add"]').should(
    'be.visible'
  );
};

export const deleteGlossary = (glossary) => {
  cy.get('.ant-menu-item').contains(glossary).click();

  cy.get('[data-testid="manage-button"]').click();

  cy.get('[data-testid="delete-button"]').scrollIntoView().click();

  cy.get('[data-testid="delete-confirmation-modal"]').then(() => {
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[data-testid="modal-header"]').should('be.visible');
  });

  cy.get('[data-testid="modal-header"]').should(
    'contain',
    `Delete ${glossary}`
  );

  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

  interceptURL('DELETE', '/api/v1/glossaries/*', 'getGlossary');

  cy.get('[data-testid="confirm-button"]').click();

  verifyResponseStatusCode('@getGlossary', 200);

  toastNotification('Glossary deleted successfully!');
};
