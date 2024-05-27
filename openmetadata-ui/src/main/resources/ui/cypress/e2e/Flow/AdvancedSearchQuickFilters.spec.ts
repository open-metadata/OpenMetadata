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
  searchAndClickOnOption,
  selectNullOption,
} from '../../common/advancedSearchQuickFilters';
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { goToAdvanceSearch } from '../../common/Utils/AdvancedSearch';
import { addDomainToEntity } from '../../common/Utils/Domain';
import {
  createEntityViaREST,
  deleteEntityViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { addOwner, removeOwner } from '../../common/Utils/Owner';
import { assignTags, removeTags } from '../../common/Utils/Tags';
import { addTier, removeTier } from '../../common/Utils/Tier';
import {
  FilterItem,
  QUICK_FILTERS_BY_ASSETS,
  SUPPORTED_EMPTY_FILTER_FIELDS,
} from '../../constants/advancedSearchQuickFilters.constants';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';
import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import { DOMAIN_QUICK_FILTERS_DETAILS } from '../../constants/EntityConstant';
const ownerName = 'Aaron Johnson';

const preRequisitesForTests = () => {
  cy.getAllLocalStorage().then((data) => {
    const token = getToken(data);

    createEntityViaREST({
      body: DOMAIN_QUICK_FILTERS_DETAILS,
      endPoint: EntityType.Domain,
      token,
    });

    visitEntityDetailsPage({
      term: SEARCH_ENTITY_TABLE.table_1.term,
      entity: SEARCH_ENTITY_TABLE.table_1.entity,
      serviceName: SEARCH_ENTITY_TABLE.table_1.serviceName,
    });
    addDomainToEntity(DOMAIN_QUICK_FILTERS_DETAILS.displayName);
    addOwner(ownerName);
    assignTags('PersonalData.Personal', EntityType.Table);
    addTier('Tier1');
  });
};

const postRequisitesForTests = () => {
  cy.getAllLocalStorage().then((data) => {
    const token = getToken(data);
    // Domain 1 to test
    deleteEntityViaREST({
      entityName: DOMAIN_QUICK_FILTERS_DETAILS.name,
      endPoint: EntityType.Domain,
      token,
    });
    visitEntityDetailsPage({
      term: SEARCH_ENTITY_TABLE.table_1.term,
      entity: SEARCH_ENTITY_TABLE.table_1.entity,
      serviceName: SEARCH_ENTITY_TABLE.table_1.serviceName,
    });
    removeOwner(ownerName);
    removeTags('PersonalData.Personal', EntityType.Table);
    removeTier();
  });
};

describe(
  `Advanced search quick filters should work properly for assets`,
  { tags: 'DataAssets' },
  () => {
    before(() => {
      cy.login();
      preRequisitesForTests();
    });

    after(() => {
      cy.login();
      postRequisitesForTests();
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
        .filter((item: FilterItem) => item.select)
        .map((filter: FilterItem) => {
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

    it('should search for empty or null filters', () => {
      const initialQuery = encodeURI(JSON.stringify({ query: { bool: {} } }));
      // Table
      interceptURL(
        'GET',
        `/api/v1/search/query?*index=table_search_index&*query_filter=${initialQuery}&*`,
        'initialQueryAPI'
      );

      const asset = QUICK_FILTERS_BY_ASSETS[0];
      cy.sidebarClick(SidebarItem.EXPLORE);
      verifyResponseStatusCode('@initialQueryAPI', 200);
      cy.get(`[data-testid="${asset.tab}"]`).scrollIntoView().click();
      asset.filters
        .filter((item) => SUPPORTED_EMPTY_FILTER_FIELDS.includes(item.key))
        .map((filter) => {
          selectNullOption(asset, filter);
        });
    });

    it('should search for multiple values alongwith null filters', () => {
      const initialQuery = encodeURI(JSON.stringify({ query: { bool: {} } }));
      // Table
      interceptURL(
        'GET',
        `/api/v1/search/query?*index=table_search_index&*query_filter=${initialQuery}&*`,
        'initialQueryAPI'
      );

      const asset = QUICK_FILTERS_BY_ASSETS[0];
      cy.sidebarClick(SidebarItem.EXPLORE);
      verifyResponseStatusCode('@initialQueryAPI', 200);
      cy.get(`[data-testid="${asset.tab}"]`).scrollIntoView().click();
      // Checking Owner with multiple values
      asset.filters
        .filter((item) => SUPPORTED_EMPTY_FILTER_FIELDS.includes(item.key))
        .map((filter: FilterItem) => {
          selectNullOption(asset, filter, filter?.selectOptionTestId1);
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
