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
  });

  it('Soft Delete entity table', () => {
    visitEntityDetailsPage(
      ENTITY_TABLE.term,
      ENTITY_TABLE.serviceName,
      ENTITY_TABLE.entity
    );

    cy.get('[data-testid="manage-button"]').should('exist').click();

    cy.get('[data-testid="delete-button-title"]').should('exist').click();

    cy.get('.ant-modal-header')
      .should('be.visible')
      .contains(`Delete ${ENTITY_TABLE.displayName}`);

    cy.get('[data-testid="soft-delete-option"]').should('exist').click();

    cy.get('[data-testid="confirm-button"]').should('be.disabled');
    cy.get('[data-testid="confirmation-text-input"]')
      .should('exist')
      .type(DELETE_TERM);

    interceptURL(
      'DELETE',
      'api/v1/tables/*?hardDelete=false&recursive=false',
      'softDeleteTable'
    );
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    verifyResponseStatusCode('@softDeleteTable', 200);

    toastNotification('Table deleted successfully!');
  });

  it('Check Soft Deleted entity table', () => {
    cy.get('[data-testid="appbar-item-explore"]').should('exist').click();
    interceptURL(
      'GET',
      'api/v1/search/query?q=&index=table_search_index&from=0&size=10&deleted=true&query_filter=%7B%22query%22%3A%7B%22bool%22%3A%7B%7D%7D%7D&sort_field=_score&sort_order=desc',
      'showDeletedTables'
    );
    cy.get('[data-testid="show-deleted"]').should('exist').click();
    verifyResponseStatusCode('@showDeletedTables', 200);

    cy.get('[data-testid="sample_data-raw_product_catalog"]')
      .should('exist')
      .click();

    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .contains(ENTITY_TABLE.displayName);

    cy.get('[data-testid="deleted-badge"]').should('exist');
  });

  it("Check Soft Deleted table in it's Schema", () => {
    cy.get('[data-testid="appbar-item-explore"]').should('exist').click();
    interceptURL(
      'GET',
      'api/v1/search/query?q=&index=table_search_index&from=0&size=10&deleted=true&query_filter=%7B%22query%22%3A%7B%22bool%22%3A%7B%7D%7D%7D&sort_field=_score&sort_order=desc',
      'showDeletedTables'
    );
    cy.get('[data-testid="show-deleted"]').should('exist').click();
    verifyResponseStatusCode('@showDeletedTables', 200);

    cy.get('[data-testid="sample_data-raw_product_catalog"]')
      .should('exist')
      .click();

    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .contains(ENTITY_TABLE.displayName);

    cy.get('[data-testid="breadcrumb-link"]')
      .should('be.visible')
      .within(() => {
        cy.contains(ENTITY_TABLE.displayName);
      });

    cy.get('[data-testid="deleted-badge"]').should('exist');

    cy.get('[data-testid="breadcrumb-link"]')
      .should('be.visible')
      .within(() => {
        cy.contains(ENTITY_TABLE.schemaName).click();
      });

    cy.get('[data-testid="manage-button"]').should('exist').click();

    cy.get('[data-testid="deleted-table-menu-item-label"]')
      .should('exist')
      .contains('Show Deleted Table');

    cy.get('[data-testid="deleted-table-menu-item-switch')
      .should('exist')
      .click();

    cy.get('[data-testid="Tables"] [data-testid="filter-count"]')
      .should('exist')
      .contains('1');

    cy.get('.ant-table-row > :nth-child(1)')
      .should('exist')
      .contains(ENTITY_TABLE.displayName);
  });

  it('Restore Soft Deleted table', () => {
    cy.get('[data-testid="appbar-item-explore"]').should('exist').click();
    interceptURL(
      'GET',
      'api/v1/search/query?q=&index=table_search_index&from=0&size=10&deleted=true&query_filter=%7B%22query%22%3A%7B%22bool%22%3A%7B%7D%7D%7D&sort_field=_score&sort_order=desc',
      'showDeletedTables'
    );
    cy.get('[data-testid="show-deleted"]').should('exist').click();
    verifyResponseStatusCode('@showDeletedTables', 200);

    cy.get('[data-testid="sample_data-raw_product_catalog"]')
      .should('exist')
      .click();

    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .contains(ENTITY_TABLE.displayName);

    cy.get('[data-testid="breadcrumb-link"]')
      .should('be.visible')
      .within(() => {
        cy.contains(ENTITY_TABLE.displayName);
      });

    cy.get('[data-testid="deleted-badge"]').should('exist');

    cy.get('[data-testid="manage-button"]').should('exist').click();

    cy.get('[data-testid="restore-button"]').should('be.visible').click();

    cy.get('.ant-modal-header').should('be.visible').contains('Restore table');

    cy.get('[data-testid="restore-modal-body"]')
      .should('be.visible')
      .contains(
        `Are you sure you want to restore ${ENTITY_TABLE.displayName}?`
      );

    cy.get('.ant-btn-primary').should('be.visible').contains('Restore').click();

    cy.wait(500);

    cy.get('[data-testid="deleted-badge"]').should('not.exist');
  });
});
