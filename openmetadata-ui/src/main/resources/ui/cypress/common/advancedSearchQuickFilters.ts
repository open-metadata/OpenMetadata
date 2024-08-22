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

import { interceptURL, verifyResponseStatusCode } from './common';

export const searchAndClickOnOption = (asset, filter, checkedAfterClick) => {
  let testId = Cypress._.toLower(filter.selectOptionTestId1);
  // Filtering for tiers is done on client side, so no API call will be triggered
  if (filter.key !== 'tier.tagFQN') {
    // Search for filter
    interceptURL(
      'GET',
      `/api/v1/search/aggregate?index=${asset.searchIndex}&field=${filter.key}**`,
      'aggregateAPI'
    );

    cy.get('[data-testid="search-input"]').clear().type(filter.selectOption1);
    verifyResponseStatusCode('@aggregateAPI', 200);
  } else {
    testId = filter.selectOptionTestId1;
  }

  cy.get(`[data-testid="${testId}"]`).should('exist').and('be.visible').click();
  checkCheckboxStatus(`${testId}-checkbox`, checkedAfterClick);
};

export const selectNullOption = (asset, filter, existingValue?: any) => {
  const queryFilter = JSON.stringify({
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  bool: {
                    must_not: {
                      exists: { field: `${filter.key}` },
                    },
                  },
                },
                ...(existingValue
                  ? [
                      {
                        term: {
                          [filter.key]:
                            filter.key === 'tier.tagFQN'
                              ? existingValue
                              : Cypress._.toLower(existingValue),
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
        ],
      },
    },
  });

  const querySearchURL = `api/v1/search/query?*index=${asset.searchIndex}*`;
  const alias = `querySearchAPI${filter.label}`;
  cy.get(`[data-testid="search-dropdown-${filter.label}"]`)
    .scrollIntoView()
    .click();

  cy.get(`[data-testid="no-option-checkbox"]`).click();

  if (existingValue) {
    searchAndClickOnOption(asset, filter, true);
  }

  interceptURL('GET', querySearchURL, alias);
  cy.get('[data-testid="update-btn"]').click();

  cy.wait(`@${alias}`).then((xhr) => {
    const actualQueryFilter = xhr.request.query['query_filter'] as string;

    expect(actualQueryFilter).to.deep.equal(queryFilter);
  });

  cy.get(`[data-testid="clear-filters"]`).scrollIntoView().click();
};

export const checkCheckboxStatus = (boxId, isChecked) => {
  cy.get(`[data-testid="${boxId}"]`)
    .should('exist')
    .and(`${isChecked ? 'be' : 'not'}.checked`);
};
