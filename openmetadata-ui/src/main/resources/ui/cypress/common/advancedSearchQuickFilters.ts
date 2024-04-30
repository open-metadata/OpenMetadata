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
  // Search for filter
  interceptURL(
    'GET',
    `/api/v1/search/aggregate?index=${asset.searchIndex}&field=${filter.key}**`,
    'aggregateAPI'
  );

  cy.get('[data-testid="search-input"]').clear().type(filter.selectOption1);

  verifyResponseStatusCode('@aggregateAPI', 200);

  cy.get(`[data-testid="${Cypress._.toLower(filter.selectOptionTestId1)}"]`)
    .should('exist')
    .and('be.visible')
    .click();

  checkCheckboxStatus(
    `${Cypress._.toLower(filter.selectOptionTestId1)}-checkbox`,
    checkedAfterClick
  );
};

export const checkCheckboxStatus = (boxId, isChecked) => {
  cy.get(`[data-testid="${boxId}"]`)
    .should('exist')
    .and(`${isChecked ? 'be' : 'not'}.checked`);
};
