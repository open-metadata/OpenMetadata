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

import { addOwner, removeOwner } from '../../common/advancedSearch';
import { searchAndClickOnOption } from '../../common/advancedSearchQuickFilters';
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { QUICK_FILTERS_BY_ASSETS } from '../../constants/advancedSearchQuickFilters.constants';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';
const ownerName = 'Aaron Johnson';

describe(`Advanced search quick filters should work properly for assets`, () => {
  before(() => {
    cy.login();
    addOwner({ ownerName, ...SEARCH_ENTITY_TABLE.table_1 });
  });

  after(() => {
    cy.login();
    removeOwner();
  });

  beforeEach(() => {
    cy.login();
  });

  it(`should show the quick filters for respective assets`, () => {
    // Navigate to explore page
    cy.get('[data-testid="app-bar-item-explore"]').click();
    QUICK_FILTERS_BY_ASSETS.map((asset) => {
      cy.get(`[data-testid="${asset.tab}"]`).scrollIntoView().click();

      asset.filters.map((filter) => {
        cy.get(`[data-testid="search-dropdown-${filter.label}"]`)
          .should('exist')
          .and('be.visible');
      });
    });
  });

  it('search dropdown should work properly for tables', () => {
    // Table
    const asset = QUICK_FILTERS_BY_ASSETS[0];

    // Navigate to explore page
    cy.get('[data-testid="app-bar-item-explore"]').click();
    cy.get(`[data-testid="${asset.tab}"]`).scrollIntoView().click();

    asset.filters
      .filter((item) => item.select)
      .map((filter) => {
        cy.get(`[data-testid="search-dropdown-${filter.label}"]`).click();
        searchAndClickOnOption(asset, filter, true);

        const querySearchURL = `/api/v1/search/query?*index=${
          asset.searchIndex
        }*query_filter=*should*${filter.key}*${encodeURI(
          Cypress._.toLower(filter.selectOption1)
        )}*`;

        interceptURL('GET', querySearchURL, 'querySearchAPI');

        cy.get('[data-testid="update-btn"]')
          .should('exist')
          .and('be.visible')
          .click();

        verifyResponseStatusCode('@querySearchAPI', 200);
      });
  });
});
