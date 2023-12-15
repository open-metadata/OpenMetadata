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
import { interceptURL, verifyResponseStatusCode } from '../common';

export const addDomainToEntity = (domainName: string) => {
  interceptURL('GET', '/api/v1/domains?limit=*', 'getDomains');

  cy.get('[data-testid="add-domain"]').click();

  cy.get('[data-testid="selectable-list"]').should('be.visible');

  verifyResponseStatusCode('@getDomains', 200);

  interceptURL(
    'GET',
    `/api/v1/search/query?q=*${encodeURI(
      domainName
    )}*&from=*&size=*&index=domain_search_index`,
    'searchDomain'
  );

  cy.get('[data-testid="selectable-list"] [data-testid="searchbar"]').type(
    domainName
  );

  verifyResponseStatusCode('@searchDomain', 200);

  interceptURL('PATCH', `/api/v1/**`, 'patchDomain');

  cy.get(`.ant-popover [title="${domainName}"]`).click();
  verifyResponseStatusCode('@patchDomain', 200);

  cy.get('[data-testid="domain-link"]').should('contain', domainName);
};

export const removeDomainFromEntity = (domainName: string) => {
  interceptURL('GET', '/api/v1/domains?limit=*', 'getDomains');

  cy.get('[data-testid="add-domain"]').click();

  cy.get('[data-testid="selectable-list"]').should('be.visible');

  verifyResponseStatusCode('@getDomains', 200);

  interceptURL('PATCH', `/api/v1/**`, 'patchDomain');

  cy.get(`[title="${domainName}"]`)
    .find('[data-testid="remove-owner"]')
    .click();
  verifyResponseStatusCode('@patchDomain', 200);

  cy.get('[data-testid="header-domain-container"]').should(
    'contain',
    'No Domain'
  );
};
