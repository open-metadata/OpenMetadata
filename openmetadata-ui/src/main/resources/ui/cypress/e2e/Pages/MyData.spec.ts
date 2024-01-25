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
import {
  interceptURL,
  login,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  generateRandomTable,
  hardDeleteService,
} from '../../common/EntityUtils';
import { createEntityTableViaREST } from '../../common/Utils/Entity';
import { DATABASE_SERVICE, USER_DETAILS } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

let userId = '';

// generate schema for 20 tables
const tables = Array(20)
  .fill(undefined)
  .map(() => generateRandomTable());

const verifyEntities = ({ url }) => {
  interceptURL('GET', url, 'getEntities');
  cy.get('[data-testid="pagination"] .ant-btn-default')
    .scrollIntoView()
    .click();

  // change pagination size to 25
  cy.get('[role="menu"] [value="25"]').click();
  verifyResponseStatusCode('@getEntities', 200);

  // verify all tables are present
  tables.forEach((table) => {
    cy.get(
      `[data-testid="table-data-card_${table.databaseSchema}.${table.name}"]`
    ).should('be.exist');
  });
};

const prepareData = () => {
  cy.login();
  cy.getAllLocalStorage().then((data) => {
    const token = Object.values(data)[0].oidcIdToken;

    // create user
    cy.request({
      method: 'POST',
      url: `/api/v1/users/signup`,
      headers: { Authorization: `Bearer ${token}` },
      body: USER_DETAILS,
    }).then((response) => {
      userId = response.body.id;
      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        tables: [],
      });

      // generate 20 tables with newly created user as owner
      tables.forEach((table) => {
        cy.request({
          method: 'POST',
          url: `/api/v1/tables`,
          headers: { Authorization: `Bearer ${token}` },
          body: { ...table, owner: { id: response.body.id, type: 'user' } },
        }).then((tableResponse) => {
          cy.request({
            method: 'PUT',
            url: `/api/v1/tables/${tableResponse.body.id}/followers`,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(response.body.id),
          });
        });
      });
    });
  });
  cy.logout();
};

const cleanUp = () => {
  cy.login();
  cy.getAllLocalStorage().then((data) => {
    const token = Object.values(data)[0].oidcIdToken;
    hardDeleteService({
      token,
      serviceFqn: DATABASE_SERVICE.service.name,
      serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
    });
    cy.request({
      method: 'DELETE',
      url: `/api/v1/users/${userId}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    });
  });
};

describe('My Data page', () => {
  before(prepareData);
  after(cleanUp);

  beforeEach(() => {
    // login with newly created user
    login(USER_DETAILS.email, USER_DETAILS.password);
  });

  it('Verify my data widget', () => {
    cy.get('[data-testid="my-data-widget"]').scrollIntoView();

    // verify total count
    cy.get('[data-testid="my-data-total-count"]')
      .invoke('text')
      .should('eq', '(20)');
    cy.get(
      '[data-testid="my-data-widget"] [data-testid="view-all-link"]'
    ).click();
    verifyEntities({
      url: '/api/v1/search/query?q=*&index=all&from=0&size=25',
    });
  });

  it('Verify following widget', () => {
    cy.get('[data-testid="following-widget"]').scrollIntoView();

    // verify total count
    cy.get('[data-testid="following-data-total-count"]')
      .invoke('text')
      .should('eq', '(20)');
    cy.get('[data-testid="following-data"]').click();
    verifyEntities({
      url: '/api/v1/search/query?q=*followers:*&index=all&from=0&size=25',
    });
  });
});
