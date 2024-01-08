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

export const assignGlossaryTerm = (
  glossaryTerm: string,
  endPoint: EntityType
) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'addGlossaryTerm');
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="add-tag"]'
  ).click();

  cy.get('[data-testid="tag-selector"] input')
    .should('be.visible')
    .type(glossaryTerm);

  cy.get(`[data-testid="tag-${glossaryTerm}"]`).click();

  // to close popup
  cy.clickOutside();

  cy.get(
    `[data-testid="tag-selector"] [data-testid="selected-tag-${glossaryTerm}"]`
  ).should('be.visible');

  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
  verifyResponseStatusCode('@addGlossaryTerm', 200);
  cy.get(
    `[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="tag-${glossaryTerm}"]`
  ).should('be.visible');
};

export const udpateGlossaryTerm = (
  glossaryTerm: string,
  endPoint: EntityType
) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'addGlossaryTerm');
  cy.get(
    '[data-testid="entity-right-panel"]  [data-testid="glossary-container"] [data-testid="edit-button"]'
  ).click();

  cy.get('[data-testid="tag-selector"] input')
    .should('be.visible')
    .type(glossaryTerm);

  cy.get(`[data-testid="tag-${glossaryTerm}"]`).click();

  // to close popup
  cy.clickOutside();

  cy.get(
    `[data-testid="tag-selector"] [data-testid="selected-tag-${glossaryTerm}"]`
  ).should('be.visible');
  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
  verifyResponseStatusCode('@addGlossaryTerm', 200);
  cy.get(
    `[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="tag-${glossaryTerm}"]`
  ).should('be.visible');
};

export const removeGlossaryTerm = (
  inputGlossaryTerm: string | string[],
  endPoint: EntityType
) => {
  const glossaryTerms = Array.isArray(inputGlossaryTerm)
    ? inputGlossaryTerm
    : [inputGlossaryTerm];
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'removeTags');
  glossaryTerms.forEach((glossaryTerm) => {
    cy.get(
      '[data-testid="entity-right-panel"]  [data-testid="glossary-container"] [data-testid="edit-button"]'
    ).click();

    // Remove all added tags
    cy.get(
      `[data-testid="selected-tag-${glossaryTerm}"] [data-testid="remove-tags"]`
    ).click();

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeTags', 200);
  });
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="add-tag"]'
  ).should('be.visible');
};
