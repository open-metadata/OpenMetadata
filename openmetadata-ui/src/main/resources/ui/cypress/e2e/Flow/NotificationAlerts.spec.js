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

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

import {
  addDomainFilter,
  addEntityFQNFilter,
  addEventTypeFilter,
  addGMEFilter,
  addInternalDestination,
  addOwnerFilter,
  addUpdaterNameFilter,
  deleteAlertSteps,
  verifyAlertDetails,
} from '../../common/AlertUtils';
import {
  descriptionBox,
  interceptURL,
  toastNotification,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  createSingleLevelEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import { SidebarItem } from '../../constants/Entity.interface';
import {
  DASHBOARD_SERVICE,
  DOMAIN_CREATION_DETAILS,
  USER_DETAILS,
} from '../../constants/EntityConstant';

const ALERT_NAME = `0-alert-cy-${uuid()}`;
const ALERT_DESCRIPTION = 'This is alert description';
const ALERT_UPDATED_DESCRIPTION = 'New alert description';
const TRIGGER_NAME_1 = 'All';
const TRIGGER_NAME_2 = 'Dashboard';

describe('Notification Alert Flow', () => {
  let data = {};

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = Object.values(storageData)[0].oidcIdToken;

      // Create a dashboard
      createSingleLevelEntity({
        token,
        ...DASHBOARD_SERVICE,
      });

      // Create a new user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: USER_DETAILS,
      }).then((response) => {
        data.user = response.body;
      });

      // Create a domain
      cy.request({
        method: 'PUT',
        url: `/api/v1/domains`,
        headers: { Authorization: `Bearer ${token}` },
        body: DOMAIN_CREATION_DETAILS,
      }).then((response) => {
        data.domain = response.body;
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = Object.values(storageData)[0].oidcIdToken;

      hardDeleteService({
        token,
        serviceFqn: DASHBOARD_SERVICE.service.name,
        serviceType: DASHBOARD_SERVICE.serviceType,
      });

      // Delete created domain
      cy.request({
        method: 'DELETE',
        url: `/api/v1/domains/name/${DOMAIN_CREATION_DETAILS.name}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${data.user.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  beforeEach(() => {
    interceptURL('POST', '/api/v1/events/subscriptions', 'createAlert');
    interceptURL('PATCH', '/api/v1/events/subscriptions/*', 'updateAlert');
    interceptURL('GET', `/api/v1/search/query?q=*`, 'getSearchResult');
    interceptURL('GET', '/api/v1/events/subscriptions/name/*', 'alertDetails');
    cy.login();
    cy.sidebarClick(SidebarItem.SETTINGS);
    interceptURL('GET', '/api/v1/events/subscriptions?*', 'alertsPage');
    cy.get('[data-testid="notifications"]')
      .contains('Notifications')
      .scrollIntoView()
      .click();
  });

  it('Create new alert', () => {
    verifyResponseStatusCode('@alertsPage', 200);

    cy.get('[data-testid="create-notification"]').click();

    // Enter alert name
    cy.get('#name').should('be.visible').type(ALERT_NAME);

    // Enter description
    cy.get(descriptionBox).clear().type(ALERT_DESCRIPTION);

    // Select all trigger
    cy.get('[data-testid="add-trigger-button"]').scrollIntoView().click();

    cy.get('[data-testid="trigger-select"]').scrollIntoView().click();

    cy.get('[data-testid="all-option"]').contains(TRIGGER_NAME_1).click();

    cy.get('[data-testid="trigger-select"]').should('contain', TRIGGER_NAME_1);

    // Select filters
    cy.get('[data-testid="add-filters"]').click();

    addOwnerFilter(0, data.user.displayName);

    // Select Destination
    cy.get('[data-testid="add-destination-button"]').scrollIntoView().click();

    addInternalDestination(0, 'Admins', 'Email');

    // Click save
    cy.get('[data-testid="save-button"]').scrollIntoView().click();
    cy.wait('@createAlert').then((interception) => {
      data.alertDetails = interception.response.body;

      expect(interception.response.statusCode).equal(201);
    });
    toastNotification('Alerts created successfully.');

    // Check if the alert details page is visible
    verifyResponseStatusCode('@alertDetails', 200);
    cy.get('[data-testid="alert-details-container"]').should('exist');
  });

  it('Alert details page', () => {
    const { id: alertId } = data.alertDetails;
    verifyResponseStatusCode('@alertsPage', 200);

    cy.get(`[data-row-key="${alertId}"] [data-testid="alert-name"]`)
      .should('contain', ALERT_NAME)
      .click();

    verifyResponseStatusCode('@alertDetails', 200);

    // Verify alert details
    verifyAlertDetails(data.alertDetails);
  });

  it('Edit created alert', () => {
    const { id: alertId } = data.alertDetails;

    // Go to edit alert page
    cy.get('table').should('contain', ALERT_NAME).click();

    cy.get(
      `[data-row-key="${alertId}"] [data-testid="alert-edit-${ALERT_NAME}"]`
    )
      .should('be.visible')
      .click();

    // Update description
    cy.get(descriptionBox)
      .should('be.visible')
      .click()
      .clear()
      .type(ALERT_UPDATED_DESCRIPTION);

    // Update trigger
    cy.get('[data-testid="trigger-select"]').scrollIntoView().click();
    cy.get('[data-testid="dashboard-option"]').contains(TRIGGER_NAME_2).click();

    // Filters should reset after trigger change
    cy.get('[data-testid="filter-select-0"]').should('not.exist');

    // Add multiple filters
    [...Array(6).keys()].forEach(() => {
      cy.get('[data-testid="add-filters"]').scrollIntoView().click();
    });

    addOwnerFilter(0, data.user.displayName);
    addEntityFQNFilter(1, DASHBOARD_SERVICE.entity.displayName, true);
    addEventTypeFilter(2, 'entityCreated');
    addUpdaterNameFilter(3, data.user.displayName, true);
    addDomainFilter(4, data.domain.name);
    addGMEFilter(5);

    // Add multiple destinations
    [...Array(3).keys()].forEach(() => {
      cy.get('[data-testid="add-destination-button"]').scrollIntoView().click();
    });

    addInternalDestination(1, 'Owners', 'G Chat');
    addInternalDestination(2, 'Teams', 'Slack', 'Team-select', 'Organization');
    addInternalDestination(
      3,
      'Users',
      'Email',
      'User-select',
      data.user.displayName
    );

    // Click save
    cy.get('[data-testid="save-button"]').scrollIntoView().click();
    cy.wait('@updateAlert').then((interception) => {
      data.alertDetails = interception.response.body;

      expect(interception.response.statusCode).equal(200);

      // Verify the edited alert changes
      verifyAlertDetails(interception.response.body);
    });
  });

  it('Delete created alert', () => {
    deleteAlertSteps(ALERT_NAME);
  });
});
