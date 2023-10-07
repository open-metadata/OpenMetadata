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
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { DELETE_TERM, SEARCH_ENTITY_TABLE } from '../../constants/constants';

const ENTITY_TABLE = SEARCH_ENTITY_TABLE.table_3;

describe('Restore entity functionality should work properly', () => {
  beforeEach(() => {
    cy.login();
    interceptURL(
      'GET',
      'api/v1/search/query?q=*&index=*&from=0&size=10&deleted=true&query_filter=*&sort_field=updatedAt&sort_order=desc',
      'showDeletedTables'
    );
    interceptURL(
      'GET',
      'api/v1/search/query?q=*&index=*&from=0&size=10&deleted=false&query_filter=*&sort_field=updatedAt&sort_order=desc',
      'nonDeletedTables'
    );
  });

  it('Soft Delete entity table', () => {
    visitEntityDetailsPage(
      ENTITY_TABLE.term,
      ENTITY_TABLE.serviceName,
      ENTITY_TABLE.entity
    );

    cy.get('[data-testid="manage-button"]').click();

    cy.get('[data-testid="delete-button-title"]').click();

    cy.get('.ant-modal-header').should(
      'contain',
      `Delete ${ENTITY_TABLE.displayName}`
    );

    cy.get('[data-testid="soft-delete-option"]').click();

    cy.get('[data-testid="confirm-button"]').should('be.disabled');
    cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

    interceptURL(
      'DELETE',
      'api/v1/tables/*?hardDelete=false&recursive=false',
      'softDeleteTable'
    );
    cy.get('[data-testid="confirm-button"]').should('not.be.disabled');
    cy.get('[data-testid="confirm-button"]').click();
    verifyResponseStatusCode('@softDeleteTable', 200);

    toastNotification('Table deleted successfully!', false);
  });

  it('Check Soft Deleted entity table', () => {
    cy.get('[data-testid="app-bar-item-explore"]').click();

    verifyResponseStatusCode('@nonDeletedTables', 200);
    cy.get('[data-testid="show-deleted"]').should('exist').click();
    verifyResponseStatusCode('@showDeletedTables', 200);

    cy.get('[data-testid="entity-header-display-name"]')
      .contains('raw_product_catalog')
      .click();

    cy.get('[data-testid="entity-header-display-name"]').should(
      'contain',
      ENTITY_TABLE.displayName
    );

    cy.get('[data-testid="deleted-badge"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it("Check Soft Deleted table in it's Schema", () => {
    cy.get('[data-testid="app-bar-item-explore"]').click();
    verifyResponseStatusCode('@nonDeletedTables', 200);
    cy.get('[data-testid="show-deleted"]').click();
    verifyResponseStatusCode('@showDeletedTables', 200);

    cy.get('[data-testid="entity-header-display-name"]')
      .contains('raw_product_catalog')
      .click();

    cy.get('[data-testid="entity-header-display-name"]')
      .contains(ENTITY_TABLE.displayName)
      .click();

    cy.get('[data-testid="deleted-badge"]').should('exist');

    cy.get('[data-testid="breadcrumb"]')
      .scrollIntoView()
      .contains(ENTITY_TABLE.schemaName)
      .click();

    interceptURL(
      'GET',
      '/api/v1/tables?databaseSchema=sample_data.ecommerce_db.shopify&include=deleted',
      'queryDeletedTables'
    );

    cy.get('[data-testid="show-deleted"]').click();

    verifyResponseStatusCode('@queryDeletedTables', 200);

    cy.get('[data-testid="table"] [data-testid="count"]').should(
      'contain',
      '1'
    );

    cy.get('.ant-table-row > :nth-child(1)').should(
      'contain',
      ENTITY_TABLE.displayName
    );
  });

  it('Restore Soft Deleted table', () => {
    cy.get('[data-testid="app-bar-item-explore"]').click();
    verifyResponseStatusCode('@nonDeletedTables', 200);
    cy.get('[data-testid="show-deleted"]').click();
    verifyResponseStatusCode('@showDeletedTables', 200);

    cy.get('[data-testid="entity-header-display-name"]')
      .contains('raw_product_catalog')
      .click();

    cy.get('[data-testid="entity-header-display-name"]').should(
      'contain',
      ENTITY_TABLE.displayName
    );

    cy.get('[data-testid="deleted-badge"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="manage-button"]').click();

    cy.get('[data-testid="restore-button"]').click();

    cy.get('.ant-modal-header').should('contain', 'Restore table');

    cy.get('[data-testid="restore-modal-body"]').should(
      'contain',
      `Are you sure you want to restore ${ENTITY_TABLE.displayName}?`
    );

    cy.get('.ant-btn-primary').contains('Restore').click();

    cy.wait(500);

    cy.get('[data-testid="deleted-badge"]').should('not.exist');
  });
});
