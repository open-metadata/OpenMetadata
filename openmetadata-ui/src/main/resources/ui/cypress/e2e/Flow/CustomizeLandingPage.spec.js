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
// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

import { compare } from 'fast-json-patch';
import { interceptURL, toastNotification } from '../../common/common';
import {
  checkAllWidgets,
  navigateToCustomizeLandingPage,
  navigateToLandingPage,
  openAddWidgetModal,
  removeAndCheckWidget,
  saveLayout,
} from '../../common/CustomizeLandingPageUtils';
import { PERSONA_DETAILS } from '../../constants/EntityConstant';

describe('Customize Landing Page Flow', () => {
  let testData = {};
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      // Fetch logged in user details to get user id
      cy.request({
        method: 'GET',
        url: `/api/v1/users/loggedInUser`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((userResponse) => {
        // Create a persona
        cy.request({
          method: 'POST',
          url: `/api/v1/personas`,
          headers: { Authorization: `Bearer ${token}` },
          body: { ...PERSONA_DETAILS, users: [userResponse.body.id] },
        }).then((personaResponse) => {
          testData.user = userResponse.body;
          testData.persona = personaResponse.body;
          const {
            name,
            id,
            description,
            displayName,
            fullyQualifiedName,
            href,
          } = personaResponse.body;

          // Set newly created persona as default persona for the logged in user
          const patchData = compare(userResponse.body, {
            ...userResponse.body,
            defaultPersona: {
              name,
              id,
              description,
              displayName,
              fullyQualifiedName,
              href,
              type: 'persona',
            },
          });

          cy.request({
            method: 'PATCH',
            url: `/api/v1/users/${testData.user.id}`,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json-patch+json',
            },
            body: patchData,
          });
        });
      });
    });
  });

  after(() => {
    cy.login();
    const token = localStorage.getItem('oidcIdToken');

    // Delete created user
    cy.request({
      method: 'DELETE',
      url: `/api/v1/personas/${testData.persona.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    // Delete created landing page config doc
    cy.request({
      method: 'DELETE',
      url: `/api/v1/docStore/${testData.docStoreData.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it('Creation of custom landing page config and widget removal should work properly', () => {
    navigateToCustomizeLandingPage({
      personaName: PERSONA_DETAILS.name,
      customPageDataResponse: 404,
    });

    checkAllWidgets(true);

    // Editing the layout
    removeAndCheckWidget({
      widgetTestId: 'activity-feed-widget',
      widgetKey: 'KnowledgePanel.ActivityFeed',
    });
    removeAndCheckWidget({
      widgetTestId: 'following-widget',
      widgetKey: 'KnowledgePanel.Following',
    });
    removeAndCheckWidget({
      widgetTestId: 'kpi-widget',
      widgetKey: 'KnowledgePanel.KPI',
    });

    // Save layout
    interceptURL('POST', `/api/v1/docStore`, 'getMyData');

    cy.get('[data-testid="save-button"]').click();

    cy.wait('@getMyData').then((interception) => {
      testData.docStoreData = interception.response.body;

      expect(interception.response.statusCode).equal(201);
    });

    toastNotification('Page layout created successfully.');

    navigateToLandingPage();

    // Check if removed widgets are not present on landing page
    cy.get(`[data-testid="activity-feed-widget"]`).should('not.exist');
    cy.get(`[data-testid="following-widget"]`).should('not.exist');
    cy.get(`[data-testid="kpi-widget"]`).should('not.exist');
  });

  it('Adding new widget should work properly', () => {
    navigateToCustomizeLandingPage({
      personaName: PERSONA_DETAILS.name,
      customPageDataResponse: 200,
    });

    // Check if removed widgets are not present on customize page
    cy.get('[data-testid="activity-feed-widget"]').should('not.exist');
    cy.get('[data-testid="following-widget"]').should('not.exist');
    cy.get('[data-testid="kpi-widget"]').should('not.exist');

    // Check if other widgets are present
    cy.get('[data-testid="recently-viewed-widget"]').should('exist');
    cy.get('[data-testid="my-data-widget"]').should('exist');
    cy.get('[data-testid="total-assets-widget"]').should('exist');
    cy.get('[data-testid="ExtraWidget.EmptyWidgetPlaceholder"]').should(
      'exist'
    );

    openAddWidgetModal();

    // Check if 'check' icon is present for existing widgets
    cy.get('[data-testid="MyData-check-icon"]').should('exist');
    cy.get('[data-testid="RecentlyViewed-check-icon"]').should('exist');
    cy.get('[data-testid="TotalAssets-check-icon"]').should('exist');

    // Check if 'check' icon is not present for removed widgets
    cy.get('[data-testid="ActivityFeed-check-icon"]').should('not.exist');
    cy.get('[data-testid="Following-check-icon"]').should('not.exist');
    cy.get('[data-testid="KPI-check-icon"]').should('not.exist');

    // Add Following widget
    cy.get('[data-testid="Following-widget-tab-label"]').click();
    cy.get(
      '[aria-labelledby$="KnowledgePanel.Following"] [data-testid="add-widget-button"]'
    ).click();
    cy.get('[data-testid="following-widget"]').should('exist');

    // Check if check icons are present in tab labels for newly added widgets
    openAddWidgetModal();
    cy.get('[data-testid="Following-check-icon"]').should('exist');
    cy.get('[data-testid="add-widget-modal"] [aria-label="Close"]').click();

    saveLayout();

    navigateToLandingPage();

    cy.get(`[data-testid="activity-feed-widget"]`).should('not.exist');
    cy.get(`[data-testid="kpi-widget"]`).should('not.exist');

    // Check if newly added widgets are present on landing page
    cy.get(`[data-testid="following-widget"]`).should('exist');
  });

  it('Resetting the layout flow should work properly', () => {
    // Check if removed widgets are not present on landing page
    cy.get(`[data-testid="activity-feed-widget"]`).should('not.exist');
    cy.get(`[data-testid="kpi-widget"]`).should('not.exist');

    navigateToCustomizeLandingPage({
      personaName: PERSONA_DETAILS.name,
      customPageDataResponse: 200,
    });

    // Check if removed widgets are not present on customize page
    cy.get(`[data-testid="activity-feed-widget"]`).should('not.exist');
    cy.get(`[data-testid="kpi-widget"]`).should('not.exist');

    cy.get(`[data-testid="reset-button"]`).click();

    cy.get(`[data-testid="reset-layout-modal"] .ant-modal-footer`)
      .contains('Yes')
      .click();

    toastNotification('Page layout updated successfully.');

    // Check if all widgets are present after resetting the layout
    checkAllWidgets(true);

    // Check if all widgets are present on landing page
    navigateToLandingPage();

    checkAllWidgets();
  });
});
