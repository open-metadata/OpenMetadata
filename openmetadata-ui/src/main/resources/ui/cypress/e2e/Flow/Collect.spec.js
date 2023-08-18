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

import { interceptURL } from '../../common/common';

describe('Collect end point should work properly', () => {
  const PAGES = {
    setting: {
      name: 'Settings',
      mainMenuId: `[data-testid="appbar-item-settings"]`,
    },
    explore: {
      name: 'Explore',
      mainMenuId: `[data-testid="appbar-item-explore"]`,
    },
    dataQuality: {
      name: 'Quality',
      mainMenuId: `[data-testid="appbar-item-data-quality"]`,
    },
    insight: {
      name: 'Insights',
      mainMenuId: `[data-testid="appbar-item-data-insight"]`,
    },
    glossary: {
      name: 'Glossary',
      mainMenuId: `[data-testid="governance"]`,
      subMenu: `[data-testid="appbar-item-glossary"]`,
    },
    tag: {
      name: 'Tags',
      mainMenuId: `[data-testid="governance"]`,
      subMenu: `[data-testid="appbar-item-tags"]`,
    },
  };

  const assertCollectEndPoint = () => {
    cy.wait('@collect').then(({ request, response }) => {
      expect(response.body).to.have.any.key('eventId');

      const modifiedResponse = Cypress._.omit(response.body, 'eventId');

      expect(request.body).deep.equal(modifiedResponse);
    });
  };

  beforeEach(() => {
    cy.login();
    interceptURL('PUT', '/api/v1/analytics/web/events/collect', 'collect');
  });

  Object.values(PAGES).map((page) => {
    it(`Visit ${page.name} page should trigger collect API`, () => {
      cy.get(page.mainMenuId)
        .should('be.visible')
        .click({ animationDistanceThreshold: 10 });
      if (page.subMenu) {
        // adding manual wait to open dropdown in UI
        cy.wait(500);
        cy.get(page.subMenu).should('be.visible').click();
      }
      assertCollectEndPoint();
    });
  });
});
