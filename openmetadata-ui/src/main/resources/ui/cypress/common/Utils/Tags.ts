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
import { EntityType } from '../../new-tests/base/EntityClass';
import { interceptURL, verifyResponseStatusCode } from '../common';

export const assignTags = (tag: string, endPoint: EntityType) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'addTags');
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="add-tag"]'
  ).click();

  cy.get('[data-testid="tag-selector"] input').should('be.visible').type(tag);

  cy.get(`[data-testid="tag-${tag}"]`).click();

  // to close popup
  cy.clickOutside();

  cy.get(
    `[data-testid="tag-selector"] [data-testid="selected-tag-${tag}"]`
  ).should('be.visible');

  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
  verifyResponseStatusCode('@addTags', 200);
  cy.get(
    `[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="tag-${tag}"]`
  ).should('be.visible');
};

export const udpateTags = (tag: string, endPoint: EntityType) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'addTags');
  cy.get(
    '[data-testid="entity-right-panel"]  [data-testid="tags-container"] [data-testid="edit-button"]'
  ).click();

  cy.get('[data-testid="tag-selector"] input').should('be.visible').type(tag);

  cy.get(`[data-testid="tag-${tag}"]`).click();

  // to close popup
  cy.clickOutside();

  cy.get(
    `[data-testid="tag-selector"] [data-testid="selected-tag-${tag}"]`
  ).should('be.visible');
  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
  verifyResponseStatusCode('@addTags', 200);
  cy.get(
    `[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="tag-${tag}"]`
  ).should('be.visible');
};

export const removeTags = (
  inputTag: string | string[],
  endPoint: EntityType
) => {
  const tags = Array.isArray(inputTag) ? inputTag : [inputTag];
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'removeTags');
  tags.forEach((tag) => {
    cy.get(
      '[data-testid="entity-right-panel"]  [data-testid="tags-container"] [data-testid="edit-button"]'
    ).click();

    // Remove all added tags
    cy.get(
      `[data-testid="selected-tag-${tag}"] [data-testid="remove-tags"]`
    ).click();

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeTags', 200);
  });
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="add-tag"]'
  ).should('be.visible');
};
