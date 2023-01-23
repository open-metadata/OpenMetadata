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

import { MYDATA_SUMMARY_OPTIONS } from '../constants/constants';
import {
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from './common';

export const openFilterDropdown = (asset, filter) => {
  interceptURL(
    'GET',
    `http://localhost:8585/api/v1/search/aggregate?index=${asset.searchIndex}&field=${filter.key}`,
    'aggregateAPI'
  );

  // Click on desired dropdown
  cy.get(`[data-testid="search-dropdown-${filter.label}"]`)
    .should('exist')
    .and('be.visible')
    .click();

  verifyResponseStatusCode('@aggregateAPI', 200);

  cy.get('[data-testid="drop-down-menu"]').should('exist').and('be.visible');
};

export const applyQuickFilterAndCheck = (
  asset,
  filter,
  selectOption,
  selectOptionTestId
) => {
  openFilterDropdown(asset, filter);

  const optionName =
    filter.label === 'Service' ? asset.serviceName : selectOption;
  const optionTestId =
    filter.label === 'Service' ? asset.serviceName : selectOptionTestId;

  // Search for filter
  cy.get('[data-testid="search-input"]')
    .should('exist')
    .and('be.visible')
    .type(optionName);

  cy.get(`[data-testid="${optionTestId}"]`)
    .should('exist')
    .and('be.visible')
    .click();

  interceptURL(
    'GET',
    `http://localhost:8585/api/v1/search/query?*index=${asset.searchIndex}*query_filter=*${filter.key}*`,
    'querySearchAPI'
  );

  cy.get('[data-testid="update-btn"]')
    .should('exist')
    .and('be.visible')
    .click();

  verifyResponseStatusCode('@querySearchAPI', 200);

  const dataCardTitleTestId =
    asset.entity === MYDATA_SUMMARY_OPTIONS.dashboards
      ? `${asset.serviceName}-${asset.dashboardName}`
      : `${asset.serviceName}-${asset.term}`;

  // Assert if desired result is shown after filter is applied
  cy.get(`[data-testid="${dataCardTitleTestId}"]`).should('exist');
};

export const ownEntityAndAddTag = (termObj, ownerName) => {
  // search for the term and redirect to the respective entity tab
  visitEntityDetailsPage(termObj.term, termObj.serviceName, termObj.entity);

  // go to manage tab and search for logged in user and set the owner
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
    'getTeams'
  );
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*&from=0&size=10&index=user_search_index',
    'getUsers'
  );
  cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

  verifyResponseStatusCode('@getTeams', 200);
  verifyResponseStatusCode('@getUsers', 200);

  // Clicking on users tab
  cy.get('[data-testid="dropdown-tab"]')
    .contains('Users')
    .should('exist')
    .should('be.visible')
    .click();

  cy.wait(2000);

  cy.get('[data-testid="searchInputText"]')
    .should('exist')
    .scrollIntoView()
    .should('be.visible')
    .type(ownerName);

  // Selecting the user
  cy.get('[data-testid="list-item"]')
    .first()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="Owner"] [data-testid="owner-link"]')
    .scrollIntoView()
    .invoke('text')
    .then((text) => {
      expect(text).equal(ownerName);
    });

  // Add tag
  cy.get('[data-testid="tags"] > [data-testid="add-tag"]')
    .eq(0)
    .should('be.visible')
    .scrollIntoView()
    .click();

  cy.wait(500);

  cy.get('[data-testid="tag-selector"]')
    .should('be.visible')
    .click()
    .type(termObj.tag);

  cy.wait(500);

  cy.get('.ant-select-item-option-content').should('be.visible').click();

  cy.get(
    '[data-testid="tags-wrapper"] > [data-testid="tag-container"]'
  ).contains(termObj.tag);

  cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();

  // Assert if tag is applied
  cy.get('[data-testid="entity-tags"]')
    .scrollIntoView()
    .should('be.visible')
    .contains(termObj.tag);
};

export const checkCheckboxStatus = (boxId, isChecked) => {
  cy.get(`[data-testid="${boxId}"]`)
    .should('exist')
    .and(`${isChecked ? 'be' : 'not'}.checked`);
};
