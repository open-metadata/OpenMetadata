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

import { searchAndClickOnOption } from '../../common/advancedSearchQuickFilters';
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { goToAdvanceSearch } from '../../common/Utils/AdvancedSearch';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { addOwner, removeOwner } from '../../common/Utils/Owner';
import { QUICK_FILTERS_BY_ASSETS } from '../../constants/advancedSearchQuickFilters.constants';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';
import { SidebarItem } from '../../constants/Entity.interface';
const ownerName = 'Aaron Johnson';

describe(
  `Advanced search quick filters should work properly for assets`,
  { tags: 'DataAssets' },
  () => {
    before(() => {
      cy.login();

      visitEntityDetailsPage({
        term: SEARCH_ENTITY_TABLE.table_1.term,
        entity: SEARCH_ENTITY_TABLE.table_1.entity,
        serviceName: SEARCH_ENTITY_TABLE.table_1.serviceName,
      });

      addOwner(ownerName);
    });

    after(() => {
      cy.login();
      visitEntityDetailsPage({
        term: SEARCH_ENTITY_TABLE.table_1.term,
        entity: SEARCH_ENTITY_TABLE.table_1.entity,
        serviceName: SEARCH_ENTITY_TABLE.table_1.serviceName,
      });

      removeOwner(ownerName);
    });

    beforeEach(() => {
      cy.login();
    });

    it(`should show the quick filters for respective assets`, () => {
      // Navigate to explore page
      cy.sidebarClick(SidebarItem.EXPLORE);
      QUICK_FILTERS_BY_ASSETS.map((asset) => {
        cy.get(`[data-testid="${asset.tab}"]`).scrollIntoView().click();

        asset.filters.map((filter) => {
          cy.get(`[data-testid="search-dropdown-${filter.label}"]`)
            .scrollIntoView()
            .should('be.visible');
        });
      });
    });

    it('search dropdown should work properly for tables', () => {
      // Table
      const asset = QUICK_FILTERS_BY_ASSETS[0];

      // Navigate to explore page
      cy.sidebarClick(SidebarItem.EXPLORE);
      cy.get(`[data-testid="${asset.tab}"]`).scrollIntoView().click();

      asset.filters
        .filter((item) => item.select)
        .map((filter) => {
          cy.get(`[data-testid="search-dropdown-${filter.label}"]`).click();
          searchAndClickOnOption(asset, filter, true);

          const querySearchURL = `/api/v1/search/query?*index=${
            asset.searchIndex
          }*query_filter=*should*${filter.key}*${encodeURI(
            Cypress._.toLower(filter.selectOption1).replace(' ', '+')
          )}*`;

          interceptURL('GET', querySearchURL, 'querySearchAPI');

          cy.get('[data-testid="update-btn"]').click();

          verifyResponseStatusCode('@querySearchAPI', 200);
        });
    });
  }
);

const testIsNullAndIsNotNullFilters = (operatorTitle, queryFilter, alias) => {
  goToAdvanceSearch();

  // Check Is Null or Is Not Null
  cy.get('.rule--operator > .ant-select > .ant-select-selector').eq(0).click();
  cy.get(`[title="${operatorTitle}"]`).click();

  cy.intercept('GET', '/api/v1/search/query?*', (req) => {
    req.alias = alias;
  }).as(alias);

  cy.get('[data-testid="apply-btn"]').click();

  cy.wait(`@${alias}`).then((xhr) => {
    const actualQueryFilter = JSON.parse(xhr.request.query['query_filter']);

    expect(actualQueryFilter).to.deep.equal(queryFilter);
  });
};

describe(`Advanced Search Modal`, () => {
  beforeEach(() => {
    cy.login();
  });

  it('should check isNull and isNotNull filters', () => {
    // Check Is Null
    const isNullQuery = {
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [
                  {
                    bool: {
                      must_not: {
                        exists: { field: 'owner.displayName.keyword' },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };
    testIsNullAndIsNotNullFilters('Is null', isNullQuery, 'searchAPI');

    // Check Is Not Null
    const isNotNullQuery = {
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [{ exists: { field: 'owner.displayName.keyword' } }],
              },
            },
          ],
        },
      },
    };
    testIsNullAndIsNotNullFilters(
      'Is not null',
      isNotNullQuery,
      'newSearchAPI'
    );
  });
});
