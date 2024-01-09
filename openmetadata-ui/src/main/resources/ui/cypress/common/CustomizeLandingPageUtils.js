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

import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from './common';

export const removeAndCheckWidget = ({ widgetTestId, widgetKey }) => {
  // Click on remove widget button
  cy.get(
    `[data-testid="${widgetTestId}"] [data-testid="remove-widget-button"]`
  ).click({ waitForAnimations: true });

  cy.get(`[data-testid="${widgetTestId}"]`).should('not.exist');

  // Check if empty widget placeholder is displayed in place of removed widget
  cy.get(
    `[data-testid*="${widgetKey}"][data-testid$="EmptyWidgetPlaceholder"]`
  ).should('exist');

  // Remove empty widget placeholder
  cy.get(
    `[data-testid*="${widgetKey}"][data-testid$="EmptyWidgetPlaceholder"] [data-testid="remove-widget-button"]`
  ).click({ waitForAnimations: true });
  cy.get(
    `[data-testid*="${widgetKey}"][data-testid$="EmptyWidgetPlaceholder"]`
  ).should('not.exist');
};

export const navigateToCustomizeLandingPage = ({
  personaName,
  customPageDataResponse,
}) => {
  interceptURL('GET', '/api/v1/teams/name/*', 'settingsPage');

  cy.get('[data-testid="app-bar-item-settings"]').click();

  cy.sidebarHoverOutside();

  verifyResponseStatusCode('@settingsPage', 200);
  cy.get('[data-testid="settings-left-panel"]').should('be.visible');

  interceptURL('GET', '/api/v1/personas*', 'getPersonas');
  cy.get(`[data-menu-id*="openMetadata.customizeLandingPage"]`)
    .scrollIntoView()
    .click();

  verifyResponseStatusCode('@getPersonas', 200);

  interceptURL(
    'GET',
    `/api/v1/docStore/name/persona.${personaName}.Page.LandingPage`,
    'getCustomPageData'
  );
  interceptURL('GET', `/api/v1/users/*?fields=follows,owns`, 'getMyData');

  cy.get(
    `[data-testid="persona-details-card-${personaName}"] [data-testid="customize-page-button"]`
  ).click();

  verifyResponseStatusCode('@getCustomPageData', customPageDataResponse);
  verifyResponseStatusCode('@getMyData', 200);
};

export const saveLayout = () => {
  // Save layout
  interceptURL('PATCH', `/api/v1/docStore/*`, 'getMyData');

  cy.get('[data-testid="save-button"]').click();

  verifyResponseStatusCode('@getMyData', 200);

  toastNotification('Page layout updated successfully.');
};

export const navigateToLandingPage = () => {
  interceptURL('GET', `/api/v1/feed*`, 'getFeedsData');
  interceptURL(
    'GET',
    `/api/v1/analytics/dataInsights/charts/aggregate*`,
    'getDataInsightReport'
  );

  cy.get('#openmetadata_logo').click();

  verifyResponseStatusCode('@getFeedsData', 200);
  verifyResponseStatusCode('@getDataInsightReport', 200);
};

export const openAddWidgetModal = () => {
  interceptURL(
    'GET',
    `/api/v1/docStore?fqnPrefix=KnowledgePanel`,
    'getWidgetsList'
  );

  cy.get(
    '[data-testid="ExtraWidget.EmptyWidgetPlaceholder"] [data-testid="add-widget-button"]'
  ).click();

  verifyResponseStatusCode('@getWidgetsList', 200);
};

export const checkAllWidgets = (checkEmptyWidgetPlaceholder = false) => {
  cy.get('[data-testid="activity-feed-widget"]').should('exist');
  cy.get('[data-testid="following-widget"]').should('exist');
  cy.get('[data-testid="recently-viewed-widget"]').should('exist');
  cy.get('[data-testid="my-data-widget"]').should('exist');
  cy.get('[data-testid="kpi-widget"]').should('exist');
  cy.get('[data-testid="total-assets-widget"]').should('exist');
  if (checkEmptyWidgetPlaceholder) {
    cy.get('[data-testid="ExtraWidget.EmptyWidgetPlaceholder"]').should(
      'exist'
    );
  }
};
