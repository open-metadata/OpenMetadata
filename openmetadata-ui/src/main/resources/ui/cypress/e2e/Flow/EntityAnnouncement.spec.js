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
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForFutureDays,
} from '../../../src/utils/date-time/DateTimeUtils';
import {
  descriptionBox,
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { ANNOUNCEMENT_ENTITIES } from '../../constants/constants';

describe('Entity Announcement', () => {
  beforeEach(() => {
    cy.login();
  });

  const createAnnouncement = (title, startDate, endDate, description) => {
    cy.get('[data-testid="add-announcement"]').should('be.visible').click();
    cy.get('.ant-modal-header').contains('Make an announcement');

    cy.get('#title').type(title);

    cy.get('#startTime').click().type(`${startDate}{enter}`);
    cy.clickOutside();

    cy.get('#endTime').click().type(`${endDate}{enter}`);
    cy.clickOutside();
    cy.get(descriptionBox).type(description);

    cy.get('[id="announcement-submit"]').scrollIntoView().click();
  };

  const addAnnouncement = (value) => {
    interceptURL('GET', '/api/v1/permissions/*/name/*', 'entityPermission');
    interceptURL('GET', '/api/v1/feed/count?entityLink=*', 'entityFeed');
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');
    interceptURL('POST', '/api/v1/feed', 'waitForAnnouncement');
    interceptURL(
      'GET',
      '/api/v1/feed?entityLink=*type=Announcement',
      'announcementFeed'
    );

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);
    cy.get('[data-testid="manage-button"]').click();
    cy.get('[data-testid="announcement-button"]').click();

    cy.wait('@announcementFeed').then((res) => {
      const data = res.response.body.data;

      if (data.length > 0) {
        const token = localStorage.getItem('oidcIdToken');
        data.map((feed) => {
          cy.request({
            method: 'DELETE',
            url: `/api/v1/feed/${feed.id}`,
            headers: { Authorization: `Bearer ${token}` },
          }).then((response) => {
            expect(response.status).to.eq(200);
          });
        });
        cy.reload();
        cy.get('[data-testid="manage-button"]').click();
        cy.get('[data-testid="announcement-button"]').click();
      }
      const startDate = customFormatDateTime(getCurrentMillis(), 'yyyy-MM-dd');
      const endDate = customFormatDateTime(
        getEpochMillisForFutureDays(5),
        'yyyy-MM-dd'
      );

      cy.get('[data-testid="announcement-error"]')
        .should('be.visible')
        .contains('No Announcements, Click on add announcement to add one.');

      // Create Active Announcement
      createAnnouncement(
        'Announcement Title',
        startDate,
        endDate,
        'Announcement Description'
      );

      // wait time for success toast message
      verifyResponseStatusCode('@waitForAnnouncement', 201);
      cy.get('.Toastify__close-button >').should('be.visible').click();
      // Create InActive Announcement

      const InActiveStartDate = customFormatDateTime(
        getEpochMillisForFutureDays(6),
        'yyyy-MM-dd'
      );
      const InActiveEndDate = customFormatDateTime(
        getEpochMillisForFutureDays(11),
        'yyyy-MM-dd'
      );

      createAnnouncement(
        'InActive Announcement Title',
        InActiveStartDate,
        InActiveEndDate,
        'InActive Announcement Description'
      );

      // wait time for success toast message
      verifyResponseStatusCode('@waitForAnnouncement', 201);
      cy.get('.Toastify__close-button >').should('be.visible').click();
      // check for inActive-announcement
      cy.get('[data-testid="inActive-announcements"]').should('be.visible');

      // close announcement drawer
      cy.get('[data-testid="title"] .anticon-close')
        .should('be.visible')
        .click();

      // reload page to get the active announcement card
      cy.reload();
      verifyResponseStatusCode('@entityPermission', 200);
      verifyResponseStatusCode('@getEntityDetails', 200);
      verifyResponseStatusCode('@entityFeed', 200);

      // check for announcement card on entity page
      cy.get('[data-testid="announcement-card"]').should('be.visible');
    });
  };

  ANNOUNCEMENT_ENTITIES.forEach((entity) => {
    it(`Add announcement and verify the active announcement for ${entity.entity}`, () => {
      addAnnouncement(entity);
    });
  });
  ANNOUNCEMENT_ENTITIES.forEach((value) => {
    it(`Delete announcement ${value.entity}`, () => {
      interceptURL(
        'GET',
        '/api/v1/feed?entityLink=*type=Announcement',
        'announcementFeed'
      );
      interceptURL('DELETE', '/api/v1/feed/*', 'deleteFeed');
      visitEntityDetailsPage(value.term, value.serviceName, value.entity);
      cy.get('[data-testid="manage-button"]').click();
      cy.get('[data-testid="announcement-button"]').click();

      verifyResponseStatusCode('@announcementFeed', 200);
      cy.get('[data-testid="main-message"]').each(($message) => {
        cy.wrap($message)
          .trigger('mouseover')
          .then(() => {
            cy.get('[data-testid="delete-message"]').click({ force: true });
            cy.get('.ant-modal-body').should(
              'contain',
              'Are you sure you want to permanently delete this message?'
            );
            cy.get('[data-testid="save-button"]').click();
            verifyResponseStatusCode('@deleteFeed', 200);
          });
      });
    });
  });
});
