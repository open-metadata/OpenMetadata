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

import { BASE_URL } from '../../constants/constants';
import {
  NAVBAR_DETAILS,
  SETTINGS_PAGE_OPTIONS,
} from '../../constants/redirections.constants';

const validateURL = (url) => {
  cy.url().should('contain', url);
};

describe('Redirection link should work properly', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Check mydata redirection links on navbar', () => {
    Object.values(NAVBAR_DETAILS).map((navbar) => {
      cy.sidebarClick(navbar.testid);

      if (navbar.subMenu) {
        cy.sidebarHover();
        cy.sidebarClick(navbar.subMenu, navbar.testid, true);
      }
      cy.get('body').click();
      validateURL(navbar.url);
      cy.clickOnLogo();
      validateURL(`${BASE_URL}/my-data`);
    });
  });

  it('Check redirection links on settings page', () => {
    cy.sidebarClick(NAVBAR_DETAILS.settings.testid);
    Object.values(SETTINGS_PAGE_OPTIONS).forEach(
      ({ testid, url, isCustomProperty }) => {
        cy.settingClick(testid, isCustomProperty);
        validateURL(url);
      }
    );
  });
});
