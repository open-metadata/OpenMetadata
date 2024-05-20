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

import exp = require('constants');
import { EntityType } from '../../constants/Entity.interface';
import { interceptURL, verifyResponseStatusCode } from '../common';

export const assignGlossaryTerm = (
  glossaryTermFQN: string,
  glossaryTermName: string,
  endPoint: EntityType
) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'addGlossaryTerm');
  interceptURL(
    'GET',
    `/api/v1/search/query?*index=glossary_term_search_index*`,
    'searchGlossaryTerm'
  );
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="add-tag"]'
  ).click();

  cy.get('[data-testid="tag-selector"] input')
    .should('be.visible')
    .type(glossaryTermName);
  verifyResponseStatusCode('@searchGlossaryTerm', 200);

  cy.get(
    `[data-testid="tag-${glossaryTermFQN}"] .ant-select-tree-checkbox`
  ).click();

  cy.get(`[data-testid="selected-tag-${glossaryTermFQN}"]`).should(
    'be.visible'
  );

  cy.get('[data-testid="saveAssociatedTag"]').click();
  verifyResponseStatusCode('@addGlossaryTerm', 200);
  cy.get(
    `[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="tag-${glossaryTermFQN}"]`
  ).should('be.visible');
};

export const updateGlossaryTerm = (
  glossaryTermFQN: string,
  glossaryTermName: string,
  endPoint: EntityType
) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'addGlossaryTerm');
  interceptURL(
    'GET',
    `/api/v1/search/query?*index=glossary_term_search_index*`,
    'searchGlossaryTerm'
  );
  cy.get(
    '[data-testid="entity-right-panel"]  [data-testid="glossary-container"] [data-testid="edit-button"]'
  ).click();

  cy.get('[data-testid="tag-selector"] input')
    .should('be.visible')
    .type(glossaryTermName);
  verifyResponseStatusCode('@searchGlossaryTerm', 200);

  cy.get(`[data-testid="tag-${glossaryTermFQN}"]`).click();

  cy.get(`[data-testid="selected-tag-${glossaryTermFQN}"]`).should(
    'be.visible'
  );
  cy.get('[data-testid="saveAssociatedTag"]').click();
  verifyResponseStatusCode('@addGlossaryTerm', 200);
  cy.get(
    `[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="tag-${glossaryTermFQN}"]`
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
  interceptURL('GET', `/api/v1/glossaries?*`, 'fetchGlossaries');
  glossaryTerms.forEach((glossaryTerm) => {
    cy.get(
      '[data-testid="entity-right-panel"]  [data-testid="glossary-container"] [data-testid="edit-button"]'
    ).click();
    cy.wait('@fetchGlossaries').then(({ response }) => {
      expect(response.statusCode).to.eq(200);

      // Remove all added tags
      cy.get(
        `[data-testid="selected-tag-${glossaryTerm}"] [data-testid="remove-tags"]`
      ).click();

      cy.get('[data-testid="saveAssociatedTag"]')
        .scrollIntoView()
        .should('be.enabled');
      // Adding manual wait to eliminate flakiness 
      // Remove manual wait and wait for elements instead
      cy.wait(100);
      cy.get('[data-testid="saveAssociatedTag"]').click();
      verifyResponseStatusCode('@removeTags', 200);
    });
  });
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="glossary-container"] [data-testid="add-tag"]'
  ).should('be.visible');
};

export const confirmationDragAndDropGlossary = (
  dragElement: string,
  dropElement: string,
  isHeader?: boolean
) => {
  interceptURL('PATCH', `/api/v1/glossaryTerms/*`, 'patchGlossaryTerm');

  // confirmation message before the transfer
  cy.get('[data-testid="confirmation-modal"] .ant-modal-body').contains(
    `Click on Confirm if you’d like to move ${
      isHeader
        ? `${dragElement} under ${dropElement} .`
        : `${dragElement} term under ${dropElement} term.`
    }`
  );

  // click on submit modal button to confirm the transfer
  cy.get('.ant-modal-footer > .ant-btn-primary').click();

  verifyResponseStatusCode('@patchGlossaryTerm', 200);
};
