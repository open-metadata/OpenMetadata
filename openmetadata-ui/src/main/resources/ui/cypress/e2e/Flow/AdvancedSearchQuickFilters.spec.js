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
  checkCheckboxStatus,
  openFilterDropdown,
  searchAndClickOnOption,
} from '../../common/advancedSearchQuickFilters';
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { QUICK_FILTERS_BY_ASSETS } from '../../constants/advancedSearchQuickFilters.constants';

QUICK_FILTERS_BY_ASSETS.map((asset) => {
  describe.skip(`Advanced search quick filters should work properly for ${asset.label} assets`, () => {
    beforeEach(() => {
      cy.login();
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
        const isSecondOption = filter.selectOption2 !== undefined;

        openFilterDropdown(asset, filter);

        const optionName1 =
          filter.label === 'Service' ? asset.serviceName : filter.selectOption1;
        const optionTestId1 =
          filter.label === 'Service'
            ? asset.serviceName
            : filter.selectOptionTestId1;

        searchAndClickOnOption(optionName1, optionTestId1, true);

        let querySearchURL = `/api/v1/search/query?*index=${
          asset.searchIndex
        }*query_filter=*should*${filter.key}*${encodeURI(optionName1)}*`;

        if (isSecondOption) {
          const optionName2 =
            filter.label === 'Service'
              ? asset.serviceName
              : filter.selectOption2;
          const optionTestId2 =
            filter.label === 'Service'
              ? asset.serviceName
              : filter.selectOptionTestId2;

          searchAndClickOnOption(optionName2, optionTestId2, true);

          querySearchURL =
            querySearchURL + `${filter.key}*${encodeURI(optionName2)}*`;
        }

        interceptURL('GET', querySearchURL, 'querySearchAPI');

        cy.get('[data-testid="update-btn"]')
          .should('exist')
          .and('be.visible')
          .click();

        verifyResponseStatusCode('@querySearchAPI', 200);

        // Check for clear all and close button functionality
        if (isSecondOption) {
          const optionTestId2 =
            filter.label === 'Service'
              ? asset.serviceName
              : filter.selectOptionTestId2;

          openFilterDropdown(asset, filter);

          // Check if clear all button works
          cy.get(`[data-testid="clear-button"]`)
            .should('exist')
            .and('be.visible')
            .click();

          cy.get(`[data-testid="clear-button"]`).should('not.exist');

          // Check close button works without changing filters
          cy.get(`[data-testid="close-btn"]`)
            .should('exist')
            .and('be.visible')
            .click();

          openFilterDropdown(asset, filter);

          checkCheckboxStatus(`${optionTestId1}-checkbox`, true);
          checkCheckboxStatus(`${optionTestId2}-checkbox`, true);
        }
      });
    });
  });
});
