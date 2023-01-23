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
  applyQuickFilterAndCheck,
  checkCheckboxStatus,
  openFilterDropdown,
  ownEntityAndAddTag,
} from '../../common/advancedSearchQueryFilters';
import { verifyResponseStatusCode } from '../../common/common';
import {
  COMMON_DROPDOWN_ITEMS,
  QUICK_FILTERS_BY_ASSETS,
} from '../../constants/advancedSearchQuickFilters.constants';

it('Prerequisites for Advanced search quick filters tests', () => {
  cy.login();

  // Set admin display name
  cy.get(
    '[data-testid="dropdown-profile"] > [data-testid="dropdown-item"] > :nth-child(1) > [data-testid="menu-button"]'
  )
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="user-name"]').should('exist').and('be.visible').click();

  verifyResponseStatusCode('@userProfile', 200);

  // Close the user profile information dropdown
  cy.get('[data-testid="hiden-layer"]').should('exist').click();

  cy.get('[data-testid="edit-displayName"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="displayName"]')
    .should('exist')
    .and('be.visible')
    .clear()
    .type(COMMON_DROPDOWN_ITEMS[0].selectOption1);

  cy.get('[data-testid="save-displayName"]')
    .should('exist')
    .and('be.visible')
    .click();
});

QUICK_FILTERS_BY_ASSETS.map((asset) => {
  describe(`Advanced search quick filters should work properly for ${asset.label} assets`, () => {
    beforeEach(() => {
      cy.login();
    });

    it(`Prerequisite for ${asset.label} quick filter tests`, () => {
      ownEntityAndAddTag(asset, COMMON_DROPDOWN_ITEMS[0].selectOption1);
    });

    it(`search dropdown should work properly for ${asset.label}`, () => {
      // Navigate to explore page
      cy.get('[data-testid="appbar-item-explore"]')
        .should('exist')
        .and('be.visible')
        .click();

      cy.get(`[data-testid="${asset.tab}"]`)
        .scrollIntoView()
        .should('exist')
        .and('be.visible')
        .click();

      cy.wait(1000);
      asset.filters.map((filter) => {
        applyQuickFilterAndCheck(
          asset,
          filter,
          filter.selectOption1,
          filter.selectOptionTestId1
        );

        if (filter.selectOption2) {
          applyQuickFilterAndCheck(
            asset,
            filter,
            filter.selectOption2,
            filter.selectOptionTestId2
          );

          // Check if clear all button works
          openFilterDropdown(asset, filter);

          checkCheckboxStatus(`${filter.selectOptionTestId1}-checkbox`, true);
          checkCheckboxStatus(`${filter.selectOptionTestId2}-checkbox`, true);

          cy.get(`[data-testid="clear-button"]`)
            .should('exist')
            .and('be.visible')
            .click();

          checkCheckboxStatus(`${filter.selectOptionTestId1}-checkbox`, false);
          checkCheckboxStatus(`${filter.selectOptionTestId2}-checkbox`, false);

          // Check close button works without changing filters
          cy.get(`[data-testid="close-btn"]`)
            .should('exist')
            .and('be.visible')
            .click();

          openFilterDropdown(asset, filter);

          checkCheckboxStatus(`${filter.selectOptionTestId1}-checkbox`, true);
          checkCheckboxStatus(`${filter.selectOptionTestId2}-checkbox`, true);
        }
      });
    });
  });
});
