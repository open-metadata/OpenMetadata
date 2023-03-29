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
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { TAGS_ADD_REMOVE_ENTITIES } from '../../constants/tagsAddRemove.constants';

const addTags = (tag) => {
  cy.get('[data-testid="tag-selector"]').should('be.visible').click().type(tag);

  cy.get('.ant-select-item-option-content').should('be.visible').click();
  cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(tag);
};

const checkTags = (tag, checkForParentEntity) => {
  if (checkForParentEntity) {
    cy.get(
      '[data-testid="entity-tags"] [data-testid="tags-wrapper"] [data-testid="tag-container"] > :nth-child(1) > .ant-space > :nth-child(2)'
    )
      .scrollIntoView()
      .should('be.visible')
      .contains(tag);
  } else {
    cy.get(`[data-testid="tag-${tag}"]`).should('be.visible');
  }
};

const removeTags = (tag, checkForParentEntity) => {
  if (checkForParentEntity) {
    cy.get('[data-testid="entity-tags"] [data-testid="add-tag"] ')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('.ant-select-selection-item-remove > .anticon')
      .should('be.visible')
      .click();

    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
  } else {
    cy.get(`[data-testid="remove-${tag}-tag"]`).should('be.visible').click();
  }
  verifyResponseStatusCode('@tagsChange', 200);
};

describe('Check if tags addition and removal flow working properly from tables', () => {
  beforeEach(() => {
    cy.login();
  });

  TAGS_ADD_REMOVE_ENTITIES.map((entityDetails) =>
    it(`Adding and removing tags to the ${entityDetails.entity} entity should work properly`, () => {
      visitEntityDetailsPage(
        entityDetails.term,
        entityDetails.serviceName,
        entityDetails.entity
      );

      cy.get(
        '[data-testid="entity-tags"] [data-testid="tags-wrapper"] [data-testid="tag-container"] [data-testid="tags"]  [data-testid="add-tag"] span'
      )
        .should('be.visible')
        .click();

      addTags(entityDetails.tags[0]);

      interceptURL('PATCH', `/api/v1/${entityDetails.entity}/*`, 'tagsChange');

      cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();

      verifyResponseStatusCode('@tagsChange', 200);

      checkTags(entityDetails.tags[0], true);

      removeTags(entityDetails.tags[0], true);

      if (entityDetails.entity === 'mlmodels') {
        cy.get(
          `[data-testid="feature-card-${entityDetails.fieldName}"] [data-testid="tag-container"]  [data-testid="tags"] > [data-testid="add-tag"] span`
        )
          .should('be.visible')
          .click();
      } else {
        cy.get(
          `.ant-table-tbody [data-testid="tag-container"] [data-testid="add-tag"] span`
        )
          .eq(0)
          .should('be.visible')
          .click();
      }

      entityDetails.tags.map((tag) => addTags(tag));

      interceptURL(
        'PATCH',
        `/api/v1/${entityDetails.insideEntity ?? entityDetails.entity}/*`,
        'tagsChange'
      );

      cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();

      verifyResponseStatusCode('@tagsChange', 200);

      entityDetails.tags.map((tag) => checkTags(tag));

      entityDetails.tags.map((tag) => removeTags(tag));
    })
  );
});
