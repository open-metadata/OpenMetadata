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
    cy.contains('Table deleted successfully!').should('be.visible');
    cy.get('.Toastify__close-button > svg')
      .first()
      .should('be.visible')
      .click();

    // data not found should be visible while redirecting to the deleted entity details page
    cy.get(`[title="${value.term}"]`).should('be.visible').click();
    cy.location('pathname').then((loc) => {
      const fqn = loc.split('/').pop();
      cy.get('.Toastify__toast-body > :nth-child(2)')
        .should('be.visible')
        .should(
          'contain',
          `${singular} instance for ${decodeURI(fqn)} not found`
        );

      cy.get('.Toastify__close-button > svg')
        .first()
        .should('be.visible')
        .click();
      cy.get('[data-testid="no-data-image"]').should('be.visible');
      cy.contains(
        `${Cypress._.startCase(singular)} instance for ${decodeURI(
          fqn
        )} not found`
      ).should('be.visible');
    });
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

  it('Add and check active announcement for the entity', () => {
    addAnnouncement(DELETE_ENTITY.table);
  });

  it('Delete entity flow should work properly', () => {
    deleteEntity(DELETE_ENTITY.table);
  });
});
