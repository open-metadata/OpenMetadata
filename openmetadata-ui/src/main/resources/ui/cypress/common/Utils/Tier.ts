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
import { interceptURL, verifyResponseStatusCode } from '../common';

export const addTier = (tier) => {
  interceptURL('PATCH', `/api/v1/**`, 'patchTier');

  interceptURL('GET', '/api/v1/tags?parent=Tier&limit=10', 'fetchTier');
  cy.get('[data-testid="edit-tier"]').click();
  verifyResponseStatusCode('@fetchTier', 200);
  cy.get(`[data-testid="radio-btn-${tier}"]`).click({
    waitForAnimations: true,
  });
  verifyResponseStatusCode('@patchTier', 200);
  cy.get(`[data-testid="radio-btn-${tier}"]`).should('be.checked');

  cy.clickOutside();
  cy.get('[data-testid="Tier"]').should('contain', tier);

  cy.get('.tier-card-popover').clickOutside();
};

export const removeTier = () => {
  interceptURL('PATCH', `/api/v1/**`, 'patchTier');

  cy.get('[data-testid="edit-tier"]').click();
  cy.get('[data-testid="clear-tier"]').scrollIntoView().click();

  verifyResponseStatusCode('@patchTier', 200);
  cy.get('[data-testid="Tier"]').should('contain', 'No Tier');

  cy.get('.tier-card-popover').clickOutside();
};
