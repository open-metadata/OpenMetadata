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
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import { interceptURL, verifyResponseStatusCode } from '../common/common';
import { BASE_URL, LOGIN } from '../constants/constants';
import { SidebarItem } from '../constants/Entity.interface';
import {
  SETTINGS_OPTIONS_PATH,
  SETTING_CUSTOM_PROPERTIES_PATH,
} from '../constants/settings.constant';
import { SIDEBAR_LIST_ITEMS } from '../constants/sidebar.constant';

Cypress.Commands.add('goToHomePage', (doNotNavigate) => {
  interceptURL('GET', '/api/v1/users/loggedInUser?fields=*', 'userProfile');
  !doNotNavigate && cy.visit('/');

  verifyResponseStatusCode('@userProfile', 200, { requestTimeout: 10000 });
});

Cypress.Commands.add('clickOnLogo', () => {
  cy.get('#openmetadata_logo > [data-testid="image"]').click();
});

const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/;
Cypress.on('uncaught:exception', (err) => {
  /* returning false here prevents Cypress from failing the test */
  if (resizeObserverLoopErrRe.test(err.message)) {
    return false;
  }
});

Cypress.Commands.add('storeSession', (username, password) => {
  /* 
  Reference docs for session https://docs.cypress.io/api/commands/session
  Its currently Experimental feature, but cypress is encouraging to use this feature
  as Cypress.Cookies.preserveOnce() and Cypress.Cookies.defaults() has been deprecated
  */

  cy.session([username, password], () => {
    cy.visit('/');
    cy.get('[id="email"]').should('be.visible').clear().type(username);
    cy.get('[id="password"]').should('be.visible').clear().type(password);
    interceptURL('POST', '/api/v1/users/login', 'login');
    cy.get('[data-testid="login"]').contains('Login').click();
    verifyResponseStatusCode('@login', 200);
    cy.url().should('not.eq', `${BASE_URL}/signin`);

    // Don't want to show any popup in the tests
    cy.setCookie(`STAR_OMD_USER_${username.split('@')[0]}`, 'true');

    // Get version and set cookie to hide version banner
    cy.request({
      method: 'GET',
      url: `api/v1/system/version`,
    }).then((res) => {
      const version = res.body.version;
      const versionCookie = `VERSION_${version
        .split('-')[0]
        .replaceAll('.', '_')}`;

      cy.setCookie(versionCookie, 'true');
      window.localStorage.setItem('loggedInUsers', username.split('@')[0]);
    });
  });
});

Cypress.Commands.add(
  'login',
  (username = LOGIN.username, password = LOGIN.password) => {
    cy.storeSession(username, password);
    cy.goToHomePage();
  }
);

Cypress.Commands.add('clickOutside', function () {
  return cy.get('body').click(0, 0); // 0,0 here are the x and y coordinates
});

Cypress.Commands.add('sidebarHover', function () {
  return cy.get('[data-testid="left-sidebar"]').trigger('mouseover'); // trigger mouseover event inside the sidebar
});

Cypress.Commands.add('sidebarHoverOutside', function () {
  return cy.get('[data-testid="left-sidebar"]').trigger('mouseout'); // trigger mouseout event outside the sidebar
});

Cypress.Commands.add('logout', () => {
  interceptURL('POST', '/api/v1/users/logout', 'logoutUser');
  cy.sidebarHover();
  cy.get(`[data-testid="app-bar-item-${SidebarItem.LOGOUT}"]`)
    .scrollIntoView()
    .click();

  cy.get('[data-testid="confirm-logout"]').click();

  // verify the logout request
  verifyResponseStatusCode('@logoutUser', 200);

  cy.url().should('eq', `${BASE_URL}/signin`);
  Cypress.session.clearAllSavedSessions();
});

/* 
  This command is used to click on the sidebar item
  id: data-testid of the sidebar item to be clicked
  */
Cypress.Commands.add('sidebarClick', (id) => {
  const items = SIDEBAR_LIST_ITEMS[id];
  if (items) {
    cy.sidebarHover();
    cy.get(`[data-testid="${items[0]}"]`).click({
      animationDistanceThreshold: 20,
      waitForAnimations: true,
    });

    cy.get(`[data-testid="app-bar-item-${items[1]}"]`).click();

    cy.get(`[data-testid="${items[0]}"]`).click();
  } else {
    cy.get(`[data-testid="app-bar-item-${id}"]`).click();
  }

  cy.sidebarHoverOutside();
});

// dataTestId of the setting options
// isCustomProperty: whether the setting option is custom properties or not
Cypress.Commands.add('settingClick', (dataTestId, isCustomProperty) => {
  let paths = SETTINGS_OPTIONS_PATH[dataTestId];

  if (isCustomProperty) {
    paths = SETTING_CUSTOM_PROPERTIES_PATH[dataTestId];
  }

  cy.sidebarClick(SidebarItem.SETTINGS);

  (paths ?? []).forEach((path: string) => {
    cy.get(`[data-testid="${path}"]`).scrollIntoView().click();
  });
});
