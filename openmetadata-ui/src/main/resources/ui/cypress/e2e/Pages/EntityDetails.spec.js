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
  getCurrentLocaleDate,
  getFutureLocaleDateFromCurrentDate,
} from '../../../src/utils/TimeUtils';
import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { DELETE_ENTITY, DELETE_TERM } from '../../constants/constants';

const entityTag = 'PersonalData.Personal';

describe('Entity Details Page', () => {
  beforeEach(() => {
    cy.login();
  });

  const deleteEntity = (value) => {
    const singular = value.entity.slice(0, -1);
    // search for the term and redirect to the respective entity tab

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);
    cy.get('[data-testid="manage-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-menu-id*="delete-button"]')
      .should('exist')
      .should('be.visible');
    // check for delete section and delete button is available or not
    // cy.get('[data-testid="danger-zone"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="delete-button-title"]')
      .should('be.visible')
      .click()
      .as('deleteBtn');

    cy.get('[data-testid="hard-delete-option"]')
      .should('contain', `Permanently Delete ${singular} “${value.term}”`)
      .should('be.visible')
      .as('permanentDelete');

    cy.get('@permanentDelete').should('be.visible').click();

    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .as('confirmBtn');

    cy.get('@confirmBtn').should('be.disabled');

    cy.get('[data-testid="discard-button"]')
      .should('be.visible')
      .as('discardBtn');

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    cy.get('@confirmBtn').should('not.be.disabled');
    cy.get('@confirmBtn').click();

    // success modal should be visible
    cy.contains('deleted successfully!').should('be.visible');
    cy.get('.Toastify__close-button > svg')
      .first()
      .should('be.visible')
      .click();

    cy.get('[data-testid="message-container"]')
      .first()
      .scrollIntoView()
      .contains(`Deleted ${singular}`)
      .should('be.visible');

    // data not found should be visible while redirecting to the deleted entity details page
    cy.get(`[title="${value.term}"]`).should('be.visible').click();
    cy.location('pathname').then((loc) => {
      const fqn = loc.split('/').pop();
      cy.get('.Toastify__toast-body > :nth-child(2)')
        .should('be.visible')
        .should('contain', `${singular} instance for ${fqn} not found`);

      cy.get('.Toastify__close-button > svg')
        .first()
        .should('be.visible')
        .click();
      cy.get('[data-testid="no-data-image"]').should('be.visible');
      cy.contains(
        `${Cypress._.startCase(singular)} instance for ${fqn} not found`
      ).should('be.visible');
    });
    cy.clickOnLogo();
  };

  const addOwnerTierAndTag = (value) => {
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    interceptURL(
      'GET',
      '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
      'waitForTeams'
    );

    cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

    verifyResponseStatusCode('@waitForTeams', 200);
    // Clicking on users tab
    cy.get('[data-testid="dropdown-tab"]')
      .contains('Users')
      .should('exist')
      .should('be.visible')
      .click();

    interceptURL('PATCH', '/api/v1/tables/*', 'validateOwner');
    // Selecting the user
    cy.get('[data-testid="list-item"]')
      .first()
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@validateOwner', 200);

    cy.get('[data-testid="owner-link"]')
      .scrollIntoView()
      .invoke('text')
      .then((text) => {
        expect(text).equal('admin');
      });

    cy.get('[data-testid="edit-Tier-icon"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="select-tier-button"]')
      .first()
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="tier-dropdown"]')
      .invoke('text')
      .then((text) => {
        expect(text).equal('Tier1');
      });

    cy.get('[data-testid="entity-tags"]').should('contain', 'Tier1');

    // add tag to the entity
    interceptURL('GET', '/api/v1/tags?limit=1000', 'tagsRequest');
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=1000&index=glossary_search_index',
      'glossaryRequest'
    );

    cy.get('[data-testid="edit-button"]').should('be.visible').click();

    cy.get('[data-testid="tag-selector"]')
      .scrollIntoView()
      .should('be.visible')
      .type(entityTag);

    verifyResponseStatusCode('@tagsRequest', 200);
    verifyResponseStatusCode('@glossaryRequest', 200);

    cy.get('.ant-select-item-option-content')
      .first()
      .should('be.visible')
      .click();

    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();

    // Test out the activity feed and task tab
    cy.get('[data-testid="Activity Feeds & Tasks"]')
      .should('be.visible')
      .click();
    // Check for tab count
    cy.get('[data-testid=filter-count').should('be.visible').contains('3');

    // Check for activity feeds - count should be 3
    // 1 for tier change , 1 for owner change, 1 for entity tag
    cy.get('[data-testid="message-container"]').its('length').should('eq', 3);

    cy.clickOnLogo();

    // checks newly generated feed for follow and setting owner
    cy.get('[data-testid="message-container"]')
      .eq(2)
      .contains('Added owner: admin')
      .should('be.visible');

    cy.get('[data-testid="message-container"]')
      .eq(1)
      .scrollIntoView()
      .contains('Added tags: Tier.Tier1')
      .should('be.visible');

    cy.clickOnLogo();
  };

  const removeOwnerAndTier = (value) => {
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    interceptURL(
      'GET',
      '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
      'waitForTeams'
    );

    cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

    verifyResponseStatusCode('@waitForTeams', 200);
    // Clicking on users tab
    cy.get('[data-testid="dropdown-tab"]')
      .contains('Users')
      .should('exist')
      .should('be.visible')
      .click();

    interceptURL('PATCH', `/api/v1/*/*`, 'removeOwner');
    // Removing the user
    cy.get('[data-testid="remove-owner"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@removeOwner', 200);

    // Check if user exist
    cy.get('[data-testid="entity-summary-details"]')
      .first()
      .scrollIntoView()
      .should('exist')
      .contains('No Owner');

    cy.get('[data-testid="edit-Tier-icon"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="remove-tier"]')
      .should('exist')
      .should('be.visible')
      .click();

    // after removing the tier entity tag should exists
    cy.get('[data-testid="entity-tags"]').should('contain', entityTag);

    cy.clickOnLogo();
  };

  const addAnnouncement = (value) => {
    const startDate = getCurrentLocaleDate();
    const endDate = getFutureLocaleDateFromCurrentDate(5);
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    cy.get('[data-testid="manage-button"]').should('be.visible').click();
    cy.get('[data-testid="announcement-button"]').should('be.visible').click();
    cy.get('[data-testid="announcement-error"]')
      .should('be.visible')
      .contains('No Announcements, Click on add announcement to add one.');
    cy.get('[data-testid="add-announcement"]').should('be.visible').click();
    cy.get('.ant-modal-header')
      .should('be.visible')
      .contains('Make an announcement');
    cy.get('.ant-modal-body').should('be.visible');
    cy.get('#title').should('be.visible').type('Announcement Title');
    cy.get('#startDate').should('be.visible').type(startDate);
    cy.get('#endtDate').should('be.visible').type(endDate);
    cy.get(descriptionBox).type('Description');

    interceptURL('POST', '/api/v1/feed', 'waitForAnnouncement');
    cy.get('[id="announcement-submit"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@waitForAnnouncement', 201);
    toastNotification('Announcement created successfully');
    cy.get('[data-testid="title"] .anticon-close').should('be.visible').click();

    // reload page to get the active announcement card
    interceptURL(
      'GET',
      '/api/v1/feed?entityLink=*&type=Announcement&activeAnnouncement=true',
      'getEntityDetails'
    );
    cy.reload();
    verifyResponseStatusCode('@getEntityDetails', 200);
    // check for announcement card on entity page
    cy.get('[data-testid="announcement-card"]').should('be.visible');

    cy.clickOnLogo();
  };

  it('Add Owner, Tier and tags for entity', () => {
    addOwnerTierAndTag(DELETE_ENTITY.table);
  });

  it('Remove Owner and Tier for entity', () => {
    removeOwnerAndTier(DELETE_ENTITY.table);
  });

  it('Add and check active announcement for the entity', () => {
    addAnnouncement(DELETE_ENTITY.table);
  });

  it('Delete entity flow should work properly', () => {
    deleteEntity(DELETE_ENTITY.table);
  });
});
