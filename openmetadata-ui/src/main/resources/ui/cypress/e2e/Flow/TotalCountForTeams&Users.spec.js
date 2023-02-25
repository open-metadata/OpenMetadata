/*
 *  Copyright 2022 Collate.
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

import { visitEntityDetailsPage } from '../../common/common';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';

const TEAM_DETAILS = SEARCH_ENTITY_TABLE.table_1;
const userURL =
  '/api/v1/search/query?q=***&from=0&size=10&index=user_search_index';
const teamURL =
  '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index';

describe('Test if the total count of users and teams is correctly displayed in the assign owner widget', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Check total count of users and teams', () => {
    const token = localStorage.getItem('oidcIdToken');

    visitEntityDetailsPage(
      TEAM_DETAILS.term,
      TEAM_DETAILS.serviceName,
      TEAM_DETAILS.entity
    );

    cy.request({
      method: 'GET',
      url: userURL,
      headers: { Authorization: `Bearer ${token}` },
    }).as('UserCount');
    cy.request({
      method: 'GET',
      url: teamURL,
      headers: { Authorization: `Bearer ${token}` },
    }).as('TeamCount');

    cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

    // check for teams count
    cy.get('@TeamCount').then((response) => {
      const teamCount = response.body.hits.total.value;
      cy.get('[data-testid="filter-count"]').eq(0).contains(`${teamCount}`);
    });

    // check for user count
    cy.get('@UserCount').then((response) => {
      const userCount = response.body.hits.total.value;
      cy.get('[data-testid="filter-count"]').eq(1).contains(`${userCount}`);
    });
  });
});
