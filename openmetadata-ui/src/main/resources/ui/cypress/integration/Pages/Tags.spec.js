/*
 *  Copyright 2021 Collate
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

import { searchEntity } from '../../common/common';
import { NEW_TAG, NEW_TAG_CATEGORY, SEARCH_ENTITY_TABLE } from '../../constants/constants';

describe('Tags page should work', () => {
  beforeEach(() => {
    cy.goToHomePage();
    cy.get(
      '.tw-ml-5 > [data-testid="dropdown-item"] > div > [data-testid="menu-button"]'
    )
      .should('be.visible')
      .click();
    cy.get('[data-testid="menu-item-Tags"]').should('be.visible').click();
  });

  it('Required Details should be available', () => {
    cy.get('[data-testid="add-category"]').should('be.visible');
    cy.get('[data-testid="add-new-tag-button"]').should('be.visible');
    cy.get('[data-testid="delete-tag-category-button"]').should('be.visible');
    cy.get('[data-testid="description"]').should('be.visible');
    cy.get('[data-testid="table"]').should('be.visible');
    cy.get('[data-testid="heading-name"]').should('be.visible');
    cy.get('[data-testid="heading-description"]').should('be.visible');
    cy.get('[data-testid="heading-actions"]').should('be.visible');

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
    cy.get('[data-testid="add-category"]').should('be.visible').click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.get('[data-testid="name"]')
      .should('be.visible')
      .type(NEW_TAG_CATEGORY.name);
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('be.visible')
      .type(NEW_TAG_CATEGORY.description);

    cy.get('[data-testid="saveButton"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('.tw-modal-container').should('not.exist');
    cy.get('[data-testid="category-name"]')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(text).to.equal(NEW_TAG_CATEGORY.name);
      });
  });

  it('Add new tag flow shoud work properly', () => {
    cy.get('[data-testid="side-panel-category"]')
      .contains(NEW_TAG_CATEGORY.name)
      .should('be.visible')
      .as('newCategory');

    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');
    cy.get('[data-testid="add-new-tag-button"]').should('be.visible').click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.get('[data-testid="name"]').should('be.visible').type(NEW_TAG.name);
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('be.visible')
      .type(NEW_TAG.description);
    cy.get('[data-testid="saveButton"]').should('be.visible').click();
  });

  it('Use newly created tag to any entity should work', () => {
    const term = SEARCH_ENTITY_TABLE.table_2.term;
    searchEntity(term);
    cy.wait(500);
    cy.get('[data-testid="table-link"]').first().contains(term).click();
    cy.get(
      '[data-testid="tags-wrapper"] > [data-testid="tag-container"] > .tw-flex > :nth-child(1) > [data-testid="tags"] > .tw-no-underline'
    )
      .should('be.visible')
      .scrollIntoView()
      .click();

    cy.get(
      '[data-testid="tags-wrapper"] > [data-testid="tag-container"]'
    ).should('be.visible');
    cy.get('[data-testid="associatedTagName"]')
      .should('be.visible')
      .type(`${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}`);
    cy.get('[data-testid="list-item"] > .tw-truncate')
      .should('be.visible')
      .click();
    cy.get(
      '[data-testid="tags-wrapper"] > [data-testid="tag-container"]'
    ).contains(`${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}`);
    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    cy.get('[data-testid="entity-tags"]')
      .scrollIntoView()
      .should('be.visible')
      .contains(`#${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}`);

    cy.get('[data-testid="table-body"] > :nth-child(1) > :nth-child(5)')
      .contains('Add tag')
      .should('be.visible')
      .click();

    cy.get(
      ':nth-child(1) > :nth-child(5) > [data-testid="tags-wrapper"] > :nth-child(1) > :nth-child(1) > [data-testid="tag-container"]'
    ).should('be.visible');
    cy.get('[data-testid="associatedTagName"]')
      .scrollIntoView()
      .should('be.visible')
      .type(`${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}`);
    cy.get('#menu-item-0 > .tw-truncate').should('be.visible').click();
    cy.get('[data-testid="saveAssociatedTag"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="table-body"] > :nth-child(1) > :nth-child(5)')
      .scrollIntoView()
      .contains(`#${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}`)
      .should('exist');
  });

  it('Check Usage of tag and it should redirect to explore page with tags filter', () => {
    cy.get('[data-testid="side-panel-category"]')
      .contains(NEW_TAG_CATEGORY.name)
      .should('be.visible')
      .as('newCategory');
    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');

    cy.get('[data-testid="usage-count"]').should('be.visible').as('count');
    cy.get('@count')
      .invoke('text')
      .then((text) => {
        expect(text).to.equal('2');
      });
    cy.get('@count').click();

    cy.get('[data-testid="table-data-card"]')
      .first()
      .contains(`#${NEW_TAG_CATEGORY.name}.${NEW_TAG.name}`)
      .should('be.visible');

    cy.get('[data-testid="filter-container-TestCategory.test"]')
      .should('be.visible')
      .find('[data-testid="checkbox"]')
      .should('be.visible')
      .should('be.checked');
  });

  it('Delete tag flow should work properly', () => {
    cy.get('[data-testid="side-panel-category"]')
      .contains(NEW_TAG_CATEGORY.name)
      .should('be.visible')
      .as('newCategory');

    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');
    cy.get('.tableBody-row > :nth-child(1)')
      .contains(NEW_TAG.name)
      .should('be.visible');

    cy.get('[data-testid="delete-tag"]').should('be.visible').click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.get('[data-testid="body-text"]')
      .contains(`Are you sure you want to delete the tag "${NEW_TAG.name}"?`)
      .should('be.visible');
    cy.get('[data-testid="save-button"]').should('be.visible').click();
    cy.wait(100);
    cy.get('.tw-modal-container').should('not.exist');
    cy.get('.tableBody-cell').contains(NEW_TAG.name).should('not.exist');
  });

  it('Delete Tag flow should work properly', () => {
    cy.get('[data-testid="side-panel-category"]')
      .contains(NEW_TAG_CATEGORY.name)
      .should('be.visible')
      .as('newCategory');

    cy.get('@newCategory')
      .click()
      .parent()
      .should('have.class', 'activeCategory');

    cy.get('[data-testid="delete-tag-category-button"]')
      .should('be.visible')
      .click();
    cy.get('.tw-modal-container').should('be.visible');
    cy.contains(
      `Are you sure you want to delete the tag category "${NEW_TAG_CATEGORY.name}"?`
    ).should('be.visible');

    cy.get('[data-testid="save-button"]').should('be.visible').click();

    cy.get('[data-testid="side-panel-category"]')
      .contains(NEW_TAG_CATEGORY.name)
      .should('not.be.exist');
  });
});
