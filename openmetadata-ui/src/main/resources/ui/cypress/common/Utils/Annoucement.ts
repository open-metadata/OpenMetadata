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
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForFutureDays,
} from '../../../src/utils/date-time/DateTimeUtils';
import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

const annoucementForm = ({ title, description, startDate, endDate }) => {
  cy.get('#title').type(title);

  cy.get('#startTime').click().type(`${startDate}{enter}`);
  cy.clickOutside();

  cy.get('#endTime').click().type(`${endDate}{enter}`);
  cy.clickOutside();
  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror').type(
    description
  );

  cy.get('[id="announcement-submit"]').scrollIntoView().click();
};

export const createAnnouncement = (announcement) => {
  interceptURL(
    'GET',
    '/api/v1/feed?entityLink=*type=Announcement',
    'announcementFeed'
  );
  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="announcement-button"]').click();

  const startDate = customFormatDateTime(getCurrentMillis(), 'yyyy-MM-dd');
  const endDate = customFormatDateTime(
    getEpochMillisForFutureDays(5),
    'yyyy-MM-dd'
  );

  cy.get('[data-testid="announcement-error"]').should(
    'contain',
    'No Announcements, Click on add announcement to add one.'
  );

  // Create Active Announcement
  cy.get('[data-testid="add-announcement"]').click();
  cy.get('.ant-modal-header').should('contain', 'Make an announcement');

  annoucementForm({ ...announcement, startDate, endDate });

  // wait time for success toast message
  verifyResponseStatusCode('@announcementFeed', 200);
  cy.get('.Toastify__close-button >').click();

  // reload page to get the active announcement card
  cy.reload();

  // check for announcement card on entity page
  cy.get('[data-testid="announcement-card"]').should(
    'contain',
    announcement.title
  );
};

export const deleteAnnoucement = () => {
  interceptURL(
    'GET',
    '/api/v1/feed?entityLink=*type=Announcement',
    'announcementFeed'
  );
  interceptURL('DELETE', '/api/v1/feed/*', 'deleteFeed');

  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="announcement-button"]').click();

  verifyResponseStatusCode('@announcementFeed', 200);

  cy.get('[data-testid="announcement-card"] [data-testid="main-message"]')
    .first()
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
};

export const createInactiveAnnouncement = (announcement) => {
  // Create InActive Announcement
  interceptURL(
    'GET',
    '/api/v1/feed?entityLink=*type=Announcement',
    'announcementFeed'
  );

  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="announcement-button"]').click();

  cy.get('[data-testid="add-announcement"]').click();
  cy.get('.ant-modal-header').should('contain', 'Make an announcement');

  const InActiveStartDate = customFormatDateTime(
    getEpochMillisForFutureDays(6),
    'yyyy-MM-dd'
  );
  const InActiveEndDate = customFormatDateTime(
    getEpochMillisForFutureDays(11),
    'yyyy-MM-dd'
  );

  annoucementForm({
    ...announcement,
    startDate: InActiveStartDate,
    endDate: InActiveEndDate,
  });

  // wait time for success toast message
  verifyResponseStatusCode('@announcementFeed', 200);
  toastNotification('Announcement created successfully!');

  cy.get('[data-testid="inActive-announcements"]').should('be.visible');
};
