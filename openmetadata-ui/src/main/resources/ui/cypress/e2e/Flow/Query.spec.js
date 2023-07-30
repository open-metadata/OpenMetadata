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
import { visitEntityDetailsPage } from '../../common/common';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';

describe('Add Query page', () => {
  const table = SEARCH_ENTITY_TABLE.table_1;

  const addQuery = ({ inputQuery, expectedErrorMessage }) => {
    cy.get('[data-testid="add-query-btn"]').click();

    cy.get('.ant-form-item-explain-error').should('not.exist');

    inputQuery &&
      cy.get('.custom-query-editor .CodeMirror-code').type(inputQuery);

    cy.get('[data-testid="save-btn"]').scrollIntoView().click();

    expectedErrorMessage
      ? cy
          .get('.ant-form-item-explain-error')
          .should('contain', expectedErrorMessage)
      : cy.get('.Toastify__toast--success').should('be.visible');
  };

  const deleteQuery = () => {
    cy.get('[data-testid="query-card-container"]').first().as('QueryContainer');

    cy.get('@QueryContainer').get('[data-testid="more-option-btn"]').click();

    cy.get('@QueryContainer')
      .get('.ant-dropdown-menu-title-content')
      .contains('Delete')
      .click();

    cy.get('.ant-modal-content [data-testid="save-button"]').click();
  };

  const editQuery = ({ inputQuery, expectedErrorMessage }) => {
    // Select Query card
    cy.get('[data-testid="query-card-container"]').first().as('QueryContainer');

    // Click on more options icon
    cy.get('@QueryContainer').get('[data-testid="more-option-btn"]').click();

    // Choose Edit option
    cy.get('@QueryContainer')
      .get('.ant-dropdown-menu-title-content')
      .contains('Edit')
      .click();

    cy.get('[data-testid="code-mirror-container"]').type(
      `{command+a}${inputQuery}`
    );

    cy.get('@QueryContainer').get('[data-testid="save-query-btn"]').click();

    expectedErrorMessage
      ? cy
          .get('.ant-form-item-explain-error')
          .should('contain', expectedErrorMessage)
      : cy.get('.Toastify__toast--success').should('be.visible');
  };

  beforeEach(() => {
    cy.login();

    visitEntityDetailsPage(table.term, table.serviceName, table.entity);

    cy.get('[data-testid="table_queries"]').click();
  });

  it('should show the error message on add query, if sql is empty', () => {
    addQuery({
      expectedErrorMessage: 'SQL Query is required',
    });
  });

  it('should show the error message on add query, if sql is invalid', () => {
    addQuery({
      inputQuery: 'invalid SQL Query',
      expectedErrorMessage: 'SQL Query is invalid',
    });
  });

  it('should add the query successfully is query is valid', () => {
    addQuery({
      inputQuery: 'Select * from DB',
    });

    deleteQuery();
  });

  it('should show the error message on edit query, if sql is invalid', () => {
    addQuery({
      inputQuery: 'Select * from DB',
    });

    editQuery({
      inputQuery: 'invalid SQL Query',
      expectedErrorMessage: 'SQL Query is invalid',
    });

    deleteQuery();
  });

  it('should update the edited query, when enter valid SQL', () => {
    addQuery({
      inputQuery: 'Select * from DB',
    });

    editQuery({
      inputQuery: 'Select * from HRMS',
    });

    deleteQuery();
  });
});
