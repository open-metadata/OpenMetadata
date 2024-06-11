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
import { interceptURL } from '../common';
import { getToken } from './LocalStorage';

/**
 * Try Performing login with the given username and password.
 * Particularly used for testing login.
 *
 * @param {string} username - The username for login
 * @param {string} password - The password for login
 * @return {void}
 */
export const performLogin = (username, password) => {
  cy.visit('/');
  interceptURL('POST', '/api/v1/users/login', 'loginUser');
  cy.get('[id="email"]').should('be.visible').clear().type(username);
  cy.get('[id="password"]').should('be.visible').clear().type(password);

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

  cy.get('.ant-btn').contains('Login').should('be.visible').click();
  cy.wait('@loginUser');
};

export const updateJWTTokenExpiryTime = (expiryTime: number) => {
  cy.getAllLocalStorage().then((data) => {
    const token = getToken(data);

    cy.request({
      method: 'PUT',
      url: `/api/v1/system/settings`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        config_type: 'loginConfiguration',
        config_value: {
          maxLoginFailAttempts: 3,
          accessBlockTime: 600,
          jwtTokenExpiryTime: expiryTime,
        },
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
};
