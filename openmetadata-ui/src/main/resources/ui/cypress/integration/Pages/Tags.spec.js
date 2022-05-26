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

import { TOTAL_SAMPLE_DATA_TAGS_COUNT } from '../../constants/constants';

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
    cy.get('[data-testid="side-panel-category"]')
      .should('be.visible')
      .should('have.length', TOTAL_SAMPLE_DATA_TAGS_COUNT);

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

  it('Add new category slow should work properly', () => {
    cy.get('[data-testid="add-category"]').should('be.visible');
  });
});
