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

import {
  interceptURL,
  toastNotification,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';
import { DESTINATION, TEST_CASE } from '../../constants/constants';

const alertForAllAssets = `Alert-ct-test-${uuid()}`;
const description = 'This is alert description';
const teamSearchTerm = 'Applications';

const deleteAlertSteps = (name) => {
  cy.get('table').should('contain', name).click();
  cy.get(`[data-testid="alert-delete-${name}"]`).should('be.visible').click();
  cy.get('.ant-modal-header')
    .should('be.visible')
    .should('contain', `Delete ${name}`);
  interceptURL('DELETE', '/api/v1/events/subscriptions/*', 'deleteAlert');
  cy.get('[data-testid="save-button"]')
    .should('be.visible')
    .should('not.disabled')
    .click();
  verifyResponseStatusCode('@deleteAlert', 200);

  toastNotification('Alert deleted successfully!');
  cy.get('table').should('not.contain', name);
};

describe('Alerts page should work properly', () => {
  beforeEach(() => {
    interceptURL('POST', '/api/v1/events/subscriptions', 'createAlert');
    interceptURL('GET', `/api/v1/search/query?q=*`, 'getSearchResult');
    cy.login();
    cy.get('[data-testid="appbar-item-settings"]')
      .should('exist')
      .and('be.visible')
      .click();
    interceptURL('GET', '/api/v1/events/subscriptions', 'alertsPage');
    cy.get('[data-testid="global-setting-left-panel"]')
      .contains('Alerts')
      .scrollIntoView()
      .should('be.visible')
      .and('exist')
      .click();
    verifyResponseStatusCode('@alertsPage', 200);
  });

  it('Create new alert for all data assets', () => {
    // Click on create alert button
    cy.get('[data-testid="create-alert"]').should('be.visible').click();
    // Enter alert name
    cy.get('#name').should('be.visible').type(alertForAllAssets);
    // Enter description
    cy.get('#description').should('be.visible').type(description);
    // Click on all data assets
    cy.get('[data-testid="triggerConfig-type"]')
      .contains('All')
      .should('be.visible');

    // Select filters
    cy.get('[data-testid="add-filters"]').should('exist').click();
    cy.get('#filteringRules_rules_0_name').invoke('show').click();
    // Select owner
    cy.get('[title="Owner"]').should('be.visible').click();
    cy.get('[data-testid="matchAnyOwnerName-select"]')
      .should('be.visible')
      .click()
      .type(teamSearchTerm);
    verifyResponseStatusCode('@getSearchResult', 200);
    cy.get(`[title="${teamSearchTerm}"]`).should('be.visible').click();
    cy.get('#description').should('be.visible').click();
    // Select include/exclude
    cy.get('[title="Include"]').should('be.visible').click();
    cy.get('[title="Include"]').eq(1).click();

    // Select Destination
    cy.get('[data-testid="alert-action-type"]').click();

    cy.get('.ant-select-item-option-content').contains('Email').click();
    // Enter email
    cy.get('#subscriptionConfig_receivers')
      .click()
      .type('testuser@openmetadata.org');
    // Click save
    cy.get('[data-testid="save"]').click();
    verifyResponseStatusCode('@createAlert', 201);
    toastNotification('Alerts created successfully.');
    cy.get('table').should('contain', alertForAllAssets);
  });

  it('Edit description for created Alert', () => {
    const updatedDescription = 'This is updated alert description';
    cy.get('table').should('contain', alertForAllAssets).click();
    cy.get(`[data-testid="alert-edit-${alertForAllAssets}"]`)
      .should('be.visible')
      .click();
    cy.get('#description')
      .should('be.visible')
      .clear()
      .focus()
      .type(updatedDescription);
    // Click save
    cy.get('[data-testid="save"]').click();
    cy.get('.ant-table-cell').should('contain', updatedDescription);
  });

  it('Delete created alert for all data assets', () => {
    deleteAlertSteps(alertForAllAssets);
  });

  it('Create new alert for all data assets and multiple filters', () => {
    interceptURL('GET', '/api/v1/events/subscriptions/*', 'createAlert');
    // Click on create alert button
    cy.get('[data-testid="create-alert"]').should('be.visible').click();
    verifyResponseStatusCode('@createAlert', 200);
    // Enter alert name
    cy.get('#name').should('be.visible').type(alertForAllAssets);
    // Enter description
    cy.get('#description').should('be.visible').type(description);
    // All data assets should be selected
    cy.get('[data-testid="triggerConfig-type"]')
      .contains('All')
      .should('be.visible');
    // Select filters
    cy.get('[data-testid="add-filters"]').should('exist').click();
    cy.get('#filteringRules_rules_0_name').invoke('show').click();
    // Select first owner
    cy.get('[title="Owner"]').should('be.visible').click();
    cy.get('[data-testid="matchAnyOwnerName-select"]')
      .should('be.visible')
      .click()
      .type(teamSearchTerm);
    verifyResponseStatusCode('@getSearchResult', 200);
    cy.get(`[title="${teamSearchTerm}"]`).should('be.visible').click();
    cy.get('#name').should('be.visible').click();

    // Select second owner
    cy.get('[data-testid="matchAnyOwnerName-select"]')
      .should('be.visible')
      .click()
      .type('Marketplace');
    cy.get('[title="Marketplace"]').should('be.visible').click();
    cy.get('#name').should('be.visible').click();

    // Select include/exclude
    cy.get('[title="Include"]').should('be.visible').click();
    cy.get('[title="Include"]').eq(1).click();

    // Select Destination
    cy.get('[data-testid="alert-action-type"]').click();

    cy.get('.ant-select-item-option-content').contains('Email').click();
    // Enter email
    cy.get('#subscriptionConfig_receivers')
      .click()
      .type('testuser@openmetadata.org');
    // Click save
    cy.get('[data-testid="save"]').click();
    toastNotification('Alerts created successfully.');
    cy.get('table').should('contain', alertForAllAssets);
  });

  it('Delete created alert for all data assets and multiple filters', () => {
    deleteAlertSteps(alertForAllAssets);
  });

  it('Create new alert for Test case data asset', () => {
    interceptURL('GET', '/api/v1/events/subscriptions/*', 'createAlert');
    // Click on create alert button
    cy.get('[data-testid="create-alert"]').should('be.visible').click();
    verifyResponseStatusCode('@createAlert', 200);
    // Enter alert name
    cy.get('#name').should('be.visible').type(TEST_CASE.testCaseAlert);
    // Enter description
    cy.get('#description')
      .should('be.visible')
      .type(TEST_CASE.testCaseDescription);
    // Click on specific data assets
    cy.get('[data-testid="triggerConfig-type"]').click();
    cy.get('[role="tree"]').find('[title="All"]').click();

    // Select Test case data asset
    cy.get('[data-testid="triggerConfig-type"]')
      .should('be.visible')
      .click()
      .type('TestCase');

    cy.get('[role="tree"]')
      .contains('Test Case')
      .scrollIntoView()
      .should('be.visible')
      .click();

    // Select filters
    cy.get('[data-testid="add-filters"]').should('exist').click();
    cy.get('#filteringRules_rules_0_name').invoke('show').click();
    // Select Test results condition

    cy.get('[title="Test Results"]').should('be.visible').click();
    cy.get('#name').should('be.visible').click();
    // Select result
    cy.get('[data-testid="matchTestResult-select"]')
      .should('be.visible')
      .click();
    cy.get('[title="Failed"]').should('be.visible').click();
    cy.get('#name').should('be.visible').click();
    // Select include/exclude
    cy.get('[title="Include"]').should('be.visible').click();
    cy.get('[title="Include"]').eq(1).click();

    // Select Destination
    cy.get('[data-testid="alert-action-type"]').click();

    cy.get('.ant-select-item-option-content').contains('Email').click();
    // Enter email
    cy.get('#subscriptionConfig_receivers')
      .click()
      .type('testuser@openmetadata.org');
    // Click save
    cy.get('[data-testid="save"]').click();
    toastNotification('Alerts created successfully.');
    cy.get('table').should('contain', TEST_CASE.testCaseAlert);
    cy.get('.ant-table-cell')
      .should('be.visible')
      .contains(TEST_CASE.testCaseAlert)
      .click();
    // Check data asset
    cy.get('[data-testid="display-name-entities"]').should(
      'contain',
      TEST_CASE.dataAsset
    );
    cy.get('div.ant-typography').should('contain', TEST_CASE.filters);
  });

  it('Delete test case alert', () => {
    deleteAlertSteps(TEST_CASE.testCaseAlert);
  });

  Object.values(DESTINATION).forEach((destination) => {
    it(`Create alert for ${destination.locator}`, () => {
      // Click on create alert button
      cy.get('[data-testid="create-alert"]').should('be.visible').click();
      // Enter alert name
      cy.get('#name').should('be.visible').type(destination.name);
      // Enter description
      cy.get('#description').should('be.visible').type(destination.description);
      // Click on all data assets
      cy.get('[data-testid="triggerConfig-type"]')
        .contains('All')
        .should('be.visible');
      // Select filters
      cy.get('[data-testid="add-filters"]').should('exist').click();
      cy.get('#filteringRules_rules_0_name').invoke('show').click();
      // Select owner
      cy.get('[title="Owner"]').should('be.visible').click();
      cy.get('[data-testid="matchAnyOwnerName-select"]')
        .should('be.visible')
        .click()
        .type(teamSearchTerm);
      verifyResponseStatusCode('@getSearchResult', 200);
      cy.get(`[title="${teamSearchTerm}"]`).should('be.visible').click();
      cy.get('#description').should('be.visible').click();
      // Select include/exclude
      cy.get('[title="Include"]').should('be.visible').click();
      cy.get('[title="Include"]').eq(1).click();

      // Select Destination
      cy.get('[data-testid="alert-action-type"]').click();

      cy.get('.ant-select-item-option-content')
        .contains(destination.locator)
        .click();
      // Enter url
      cy.get('#subscriptionConfig_endpoint').click().type(destination.url);
      // Click save
      cy.get('[data-testid="save"]').click();
      verifyResponseStatusCode('@createAlert', 201);
      toastNotification('Alerts created successfully.');
      // Verify created alert
      cy.get('table').should('contain', destination.name);
    });

    it(`Delete created alert for ${destination.name} `, () => {
      deleteAlertSteps(destination.name);
    });
  });
});
