/*
 *  Copyright 2024 Collate.
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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { SidebarItem } from '../../constants/Entity.interface';

describe.skip('Explore Page', { tags: 'DataAssets' }, () => {
  before(() => {
    cy.login();
  });

  it('should verify order of search results', () => {
    const searchText = 'customer';
    interceptURL(
      'GET',
      `api/v1/search/query?q=**&index=dataAsset**`,
      'suggestAPI'
    );

    interceptURL(
      'GET',
      `api/v1/search/query?q=**&index=table_search_index**`,
      'searchAPI'
    );

    cy.sidebarClick(SidebarItem.EXPLORE);
    cy.get('[data-testid="searchBox"]').clear();
    cy.get('[data-testid="searchBox"]').type(searchText);

    verifyResponseStatusCode('@suggestAPI', 200);

    const linksArray = [];
    cy.get('[data-testid="group-table_search_index"] button a').each(
      ($link) => {
        linksArray.push($link.attr('href'));
      }
    );

    cy.get('[data-testid="searchBox"]').type('{enter}');
    verifyResponseStatusCode('@searchAPI', 200);

    cy.wrap(linksArray).each((link, index) => {
      cy.get(`[data-testid="entity-link"]`)
        .eq(index)
        .should('have.attr', 'href', link);
    });
  });
});
