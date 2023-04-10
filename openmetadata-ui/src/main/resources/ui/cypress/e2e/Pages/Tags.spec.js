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

// / <reference types="cypress" />

import {
  addNewTagToEntity,
  descriptionBox,
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  DELETE_TERM,
  NEW_TAG,
  NEW_TAG_CATEGORY,
  SEARCH_ENTITY_TABLE,
} from '../../constants/constants';

const permanentDeleteModal = (entity) => {
  cy.get('[data-testid="delete-confirmation-modal"]')
    .should('exist')
    .then(() => {
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[data-testid="modal-header"]').should('be.visible');
    });
  cy.get('[data-testid="modal-header"]')
    .should('be.visible')
    .should('contain', `Delete ${entity}`);
  cy.get('[data-testid="confirmation-text-input"]')
    .should('be.visible')
    .type(DELETE_TERM);

  cy.get('[data-testid="confirm-button"]')
    .should('be.visible')
    .should('not.disabled')
    .click();
};

// Todo: unskip this once https://github.com/open-metadata/OpenMetadata/issues/10979 is fixed
describe.skip('Tags page should work', () => {
  beforeEach(() => {
    cy.login();
    interceptURL(
      'GET',
      `/api/v1/tags?fields=usageCount&parent=${NEW_TAG_CATEGORY.name}&limit=10`,
      'getTagList'
    );
    interceptURL('GET', `/api/v1/permissions/classification/*`, 'permissions');
    interceptURL(
      'GET',
      `/api/v1/search/suggest?q=*&index=tag_search_index*glossary_search_index`,
      'suggestTag'
    );
    interceptURL('GET', '/api/v1/tags*', 'getTags');

    cy.get('[data-testid="governance"]')
      .should('exist')
      .and('be.visible')
      .click({ animationDistanceThreshold: 20 });

    // adding manual wait to open dropdown in UI
    cy.wait(500);
    cy.get('[data-testid="appbar-item-tags"]').should('be.visible').click();
    verifyResponseStatusCode('@getTags', 200);
  });

  it('Required Details should be available', () => {
    cy.get('[data-testid="add-classification"]').should('be.visible');
    cy.get('[data-testid="add-new-tag-button"]').should('be.visible');
    cy.get('[data-testid="delete-classification-or-tag"]').should('be.visible');
    cy.get('[data-testid="description"]').should('be.visible');
    cy.get('[data-testid="table"]').should('be.visible');

    cy.get('.ant-table-thead > tr > .ant-table-cell')
      .eq(0)
      .contains('Tag')
      .should('be.visible');
    cy.get('.ant-table-thead > tr > .ant-table-cell')
      .eq(1)
      .contains('Display Name')
      .should('be.visible');
    cy.get('.ant-table-thead > tr > .ant-table-cell')
      .eq(2)
      .contains('Description')
      .should('be.visible');
    cy.get('.ant-table-thead > tr > .ant-table-cell')
      .eq(3)
      .contains('Actions')
      .should('be.visible');

    cy.get('.activeCategory > .tag-category')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        cy.get('.activeCategory > .tag-category')
          .should('be.visible')
          .invoke('text')
          .then((heading) => {
            expect(text).to.equal(heading);
          });
      });
  });

  it('Add new tag category flow should work properly', () => {
    interceptURL('POST', 'api/v1/classifications', 'createTagCategory');
    cy.get('[data-testid="add-classification"]').should('be.visible').click();
    cy.get('[data-testid="modal-container"]')
      .should('exist')
      .then(() => {
        cy.get('[role="dialog"]').should('be.visible');
      });
    cy.get('[data-testid="name"]')
      .should('be.visible')
      .type(NEW_TAG_CATEGORY.name);
    cy.get('[data-testid="displayName"]')
      .should('be.visible')
      .type(NEW_TAG_CATEGORY.displayName);
    cy.get(descriptionBox)
      .should('be.visible')
      .type(NEW_TAG_CATEGORY.description);
    cy.get('[data-testid="mutually-exclusive-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('.ant-modal-footer > .ant-btn-primary')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@createTagCategory', 201);
    cy.get('[data-testid="modal-container"]').should('not.exist');
    cy.get('[data-testid="data-summary-container"]')
      .should('be.visible')
      .and('contain', NEW_TAG_CATEGORY.displayName);
  });

  it('Add new tag flow should work properly', () => {
    cy.get('[data-testid="data-summary-container"]')
      .contains(NEW_TAG_CATEGORY.displayName)
      .should('be.visible')
      .as('newCategory');

    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');
    cy.get('[data-testid="add-new-tag-button"]').should('be.visible').click();
    cy.get('[data-testid="modal-container"]')
      .should('exist')
      .then(() => {
        cy.get('[role="dialog"]').should('be.visible');
      });
    cy.get('[data-testid="name"]').should('be.visible').type(NEW_TAG.name);
    cy.get('[data-testid="displayName"]')
      .should('be.visible')
      .type(NEW_TAG.displayName);
    cy.get(descriptionBox).should('be.visible').type(NEW_TAG.description);

    interceptURL('POST', '/api/v1/tags', 'createTag');
    cy.get('.ant-modal-footer > .ant-btn-primary').should('be.visible').click();

    verifyResponseStatusCode('@createTag', 201);

    cy.get('[data-testid="table"]').should('contain', NEW_TAG.name);
  });

  it('Use newly created tag to any entity should work', () => {
    const entity = SEARCH_ENTITY_TABLE.table_1;
    addNewTagToEntity(entity, `${NEW_TAG.name}`);
  });

  it('Add tag at DatabaseSchema level should work', () => {
    interceptURL(
      'GET',
      '/api/v1/permissions/databaseSchema/name/*',
      'permissions'
    );
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');
    interceptURL(
      'GET',
      '/api/v1/databaseSchemas/name/*?fields=owner,usageSummary,tags',
      'databaseSchemasPage'
    );
    interceptURL('PATCH', '/api/v1/databaseSchemas/*', 'addTags');

    const entity = SEARCH_ENTITY_TABLE.table_2;
    const tag = 'Sensitive';

    visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);

    cy.get('[data-testid="breadcrumb-link"]')
      .should('be.visible')
      .contains(entity.schemaName)
      .click();

    verifyResponseStatusCode('@databaseSchemasPage', 200);
    verifyResponseStatusCode('@permissions', 200);

    cy.get('[data-testid="tags"] > [data-testid="add-tag"]')
      .should('be.visible')
      .click();

    cy.get('[data-testid="tag-selector"] input').should('be.visible').type(tag);

    cy.get('.ant-select-item-option-content')
      .contains(tag)
      .should('be.visible')
      .click();

    cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(tag);
    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@addTags', 200);
    cy.get('[data-testid="entity-tags"]')
      .scrollIntoView()
      .should('be.visible')
      .contains(tag);

    cy.get('[data-testid="edit-button"]').should('exist').click();

    // Remove all added tags
    cy.get('.ant-select-selection-item-remove')
      .eq(0)
      .should('be.visible')
      .click();

    interceptURL('PATCH', '/api/v1/databaseSchemas/*', 'removeTags');
    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@removeTags', 200);

    cy.get('[data-testid="tags"] > [data-testid="add-tag"]').should(
      'be.visible'
    );
  });

  it.skip('Add tag at DatabaseSchema level with task & suggestions', () => {
    interceptURL(
      'GET',
      '/api/v1/permissions/databaseSchema/name/*',
      'permissions'
    );
    interceptURL('PUT', '/api/v1/feed/tasks/*/resolve', 'taskResolve');
    interceptURL(
      'GET',
      '/api/v1/databaseSchemas/name/*?fields=owner,usageSummary,tags',
      'databaseSchemasPage'
    );

    const entity = SEARCH_ENTITY_TABLE.table_2;
    const tag = 'PersonalData.Personal';
    const assignee = 'admin';

    visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);

    cy.get('[data-testid="breadcrumb-link"]')
      .should('be.visible')
      .contains(entity.schemaName)
      .click();

    verifyResponseStatusCode('@databaseSchemasPage', 200);
    verifyResponseStatusCode('@permissions', 200);

    // Create task to add tags
    interceptURL('POST', '/api/v1/feed', 'taskCreated');
    cy.get('[data-testid="request-entity-tags"]').should('exist').click();

    // set assignees for task
    cy.get(
      '[data-testid="select-assignee"] > .ant-select-selector > .ant-select-selection-overflow'
    )
      .should('be.visible')
      .click()
      .type(assignee);
    cy.get('.ant-select-item-option-content').contains(assignee).click();

    // click outside the select box
    cy.get('[data-testid="entity-details"]').should('exist').click();

    cy.get(
      '[data-testid="select-tags"] > .ant-select-selector > .ant-select-selection-overflow'
    )
      .should('be.visible')
      .click()
      .type(tag);

    verifyResponseStatusCode('@suggestTag', 200);
    cy.get('.ant-select-item-option-content').contains(tag).click();

    cy.get('[data-testid="tags-label"]').click();

    cy.get('[data-testid="submit-tag-request"]').should('be.visible').click();
    verifyResponseStatusCode('@taskCreated', 201);

    // Accept the tag suggestion which is created
    cy.get('.ant-btn-compact-first-item')
      .should('be.visible')
      .contains('Accept Suggestion')
      .click();

    verifyResponseStatusCode('@taskResolve', 200);
    verifyResponseStatusCode('@databaseSchemasPage', 200);

    cy.get('[data-testid="entity-tags"]')
      .scrollIntoView()
      .should('be.visible')
      .contains(tag);

    cy.get('[data-testid="edit-button"]').should('exist').click();

    // Remove all added tags
    cy.get('.ant-select-selection-item-remove')
      .eq(0)
      .should('be.visible')
      .click();

    interceptURL('PATCH', '/api/v1/databaseSchemas/*', 'removeTags');
    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@removeTags', 200);

    cy.get('[data-testid="tags"] > [data-testid="add-tag"]').should(
      'be.visible'
    );
  });

  it('Check Usage of tag and it should redirect to explore page with tags filter', () => {
    cy.get('[data-testid="data-summary-container"]')
      .contains(NEW_TAG_CATEGORY.displayName)
      .should('be.visible')
      .as('newCategory');
    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');

    verifyResponseStatusCode('@permissions', 200);
    verifyResponseStatusCode('@getTagList', 200);

    cy.get('[data-testid="usage-count"]').should('be.visible').as('count');
    cy.get('@count')
      .invoke('text')
      .then((text) => {
        expect(text).to.equal('2');
      });

    interceptURL(
      'GET',
      'api/v1/search/query?q=&index=**',
      'getEntityDetailsPage'
    );
    cy.get('@count').click();
    verifyResponseStatusCode('@getEntityDetailsPage', 200);

    cy.get('[data-testid="table-data-card"]')
      .first()
      .contains(`#${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}`)
      .should('be.visible');

    cy.get(
      `[data-testid="filter-container-${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}"]`
    )
      .should('be.visible')
      .find('[data-testid="checkbox"]')
      .should('be.visible')
      .should('be.checked');
  });

  it('Rename tag flow should work properly', () => {
    cy.get('[data-testid="data-summary-container"]')
      .contains(NEW_TAG_CATEGORY.displayName)
      .should('be.visible')
      .as('newCategory');

    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');
    cy.get('[data-testid="edit-button"]').should('be.visible').click();
    cy.get('[data-testid="modal-container"]')
      .should('exist')
      .then(() => {
        cy.get('[role="dialog"]').should('be.visible');
      });
    cy.get('[data-testid="header"] > strong')
      .should('be.visible')
      .contains('Edit Tag');

    interceptURL('PATCH', '/api/v1/tags/*', 'renamedName');
    cy.get('[data-testid="name"] input')
      .should('be.visible')
      .clear()
      .type(NEW_TAG.renamedName);

    cy.get('.ant-modal-footer > .ant-btn-primary').should('be.visible').click();

    verifyResponseStatusCode('@renamedName', 200);

    cy.get('[data-testid="table"]').should('contain', NEW_TAG.renamedName);
  });

  it('Delete Tag flow should work properly', () => {
    interceptURL(
      'DELETE',
      '/api/v1/tags/*?recursive=true&hardDelete=true',
      'deleteTag'
    );
    cy.get('[data-testid="data-summary-container"]')
      .contains(NEW_TAG_CATEGORY.displayName)
      .should('be.visible')
      .as('newCategory');

    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');

    verifyResponseStatusCode('@permissions', 200);
    verifyResponseStatusCode('@getTagList', 200);
    cy.get('[data-testid="table"]')
      .should('be.visible')
      .should('contain', NEW_TAG.renamedName);

    cy.get('[data-testid="table"]')
      .find('[data-testid="delete-tag"]')
      .should('exist')
      .and('be.visible')
      .click();

    cy.wait(5000); // adding manual wait to open modal, as it depends on click not an api.
    permanentDeleteModal(NEW_TAG.renamedName);

    verifyResponseStatusCode('@deleteTag', 200);
    cy.wait(5000); // adding manual wait to open modal, as it depends on click not an api.
    cy.get('[data-testid="table"]')
      .contains(NEW_TAG.renamedName)
      .should('not.be.exist');
  });

  it('Delete Tag classification flow should work properly', () => {
    interceptURL(
      'DELETE',
      '/api/v1/classifications/*',
      'deletTagClassification'
    );

    cy.get('[data-testid="data-summary-container"]')
      .contains(NEW_TAG_CATEGORY.displayName)
      .should('be.visible')
      .as('newCategory');

    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');

    cy.get('[data-testid="delete-classification-or-tag"]')
      .should('be.visible')
      .click();

    cy.wait(5000); // adding manual wait to open modal, as it depends on click not an api.
    permanentDeleteModal(NEW_TAG_CATEGORY.displayName);

    verifyResponseStatusCode('@deletTagClassification', 200);
    cy.get('[data-testid="data-summary-container"]')
      .contains(NEW_TAG_CATEGORY.name)
      .should('not.be.exist');
  });
});
