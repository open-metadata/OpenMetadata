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

import {
  DELETE_TERM,
  NAME_MIN_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  TAG_INVALID_NAMES,
} from '../constants/constants';
import { interceptURL, verifyResponseStatusCode } from './common';

export const submitForm = () => {
  cy.get('button[type="submit"]').scrollIntoView().should('be.visible').click();
};

export const validateForm = () => {
  // submit form without any data to trigger validation
  submitForm();

  // error messages
  cy.get('#tags_name_help').should('be.visible').contains('Name is required');
  cy.get('#tags_description_help')
    .scrollIntoView()
    .contains('Description is required');

  // validation should work for invalid names

  // min length validation
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .clear()
    .type(TAG_INVALID_NAMES.MIN_LENGTH);

  cy.get('#tags_name_help').contains(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR);

  // max length validation
  cy.get('[data-testid="name"]').clear().type(TAG_INVALID_NAMES.MAX_LENGTH);

  cy.get('#tags_name_help').contains(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR);

  // with special char validation
  cy.get('[data-testid="name"]')
    .clear()
    .type(TAG_INVALID_NAMES.WITH_SPECIAL_CHARS);

  cy.get('#tags_name_help').contains(NAME_VALIDATION_ERROR);
};

export const visitClassificationPage = () => {
  interceptURL('GET', '/api/v1/tags*', 'getTags');

  cy.sidebarHover();
  cy.get('[data-testid="governance"]').click({
    animationDistanceThreshold: 20,
    waitForAnimations: true,
  });

  cy.sidebarClick('app-bar-item-tags');

  verifyResponseStatusCode('@getTags', 200);
};

export const deleteClassification = (classificationDetails) => {
  interceptURL(
    'DELETE',
    '/api/v1/classifications/*',
    'deleteTagClassification'
  );

  cy.get('[data-testid="data-summary-container"]')
    .contains(classificationDetails.displayName)
    .click()
    .parent()
    .should('have.class', 'activeCategory');

  cy.get('[data-testid="manage-button"]').click();

  cy.get('[data-testid="delete-button"]').click({ waitForAnimations: true });

  cy.get('[data-testid="hard-delete-option"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

  cy.get('[data-testid="confirm-button"]').click();

  verifyResponseStatusCode('@deleteTagClassification', 200);

  cy.get('[data-testid="data-summary-container"]')
    .contains(classificationDetails.name)
    .should('not.be.exist');
};
