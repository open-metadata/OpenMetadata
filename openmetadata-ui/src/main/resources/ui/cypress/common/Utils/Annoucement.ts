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

const announcementForm = ({ title, description, startDate, endDate }) => {
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

export const createAnnouncement = (announcement, entityName, updatedName) => {
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

  announcementForm({ ...announcement, startDate, endDate });

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
  // Todo: Need to check announcement flow on home page @Ashish8689
  //   cy.goToHomePage();

  //   cy.get('[data-testid="announcement-container"]')
  //     .find(`a[href*="${encodeURIComponent(entityName)}"]`)
  //     .filter(':visible')
  //     .first()
  //     .click();

  //   cy.get('[data-testid="entity-header-display-name"]').should(
  //     'contain',
  //     `Cypress ${updatedName} updated`
  //   );
};

export const deleteAnnouncement = () => {
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

export const replyAnnouncementUtil = () => {
  interceptURL(
    'GET',
    '/api/v1/feed?entityLink=*type=Announcement',
    'announcementFeed'
  );
  interceptURL('GET', '/api/v1/feed/*', 'allAnnouncementFeed');
  interceptURL('POST', '/api/v1/feed/*/posts', 'addAnnouncementReply');

  cy.get('[data-testid="announcement-card"]').click();

  cy.get(
    '[data-testid="announcement-card"] [data-testid="main-message"]'
  ).trigger('mouseover');

  cy.get('[data-testid="add-reply"]').should('be.visible').click();

  cy.get('[data-testid="send-button"]').should('be.disabled');

  verifyResponseStatusCode('@allAnnouncementFeed', 200);

  cy.get('[data-testid="editor-wrapper"] .ql-editor').type('Reply message');

  cy.get('[data-testid="send-button"]').should('not.disabled').click();

  verifyResponseStatusCode('@addAnnouncementReply', 201);
  verifyResponseStatusCode('@announcementFeed', 200);
  verifyResponseStatusCode('@allAnnouncementFeed', 200);

  cy.get('[data-testid="replies"] [data-testid="viewer-container"]').should(
    'contain',
    'Reply message'
  );
  cy.get('[data-testid="show-reply-thread"]').should('contain', '1 replies');

  // Edit the reply message
  cy.get('[data-testid="replies"] > [data-testid="main-message"]').trigger(
    'mouseover'
  );

  cy.get('[data-testid="edit-message"]').should('be.visible').click();

  cy.get('.feed-message [data-testid="editor-wrapper"] .ql-editor')
    .clear()
    .type('Reply message edited');

  cy.get('[data-testid="save-button"]').click();

  cy.get('[data-testid="replies"] [data-testid="viewer-container"]').should(
    'contain',
    'Reply message edited'
  );

  cy.reload();
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

  announcementForm({
    ...announcement,
    startDate: InActiveStartDate,
    endDate: InActiveEndDate,
  });

  // wait time for success toast message
  verifyResponseStatusCode('@announcementFeed', 200);
  toastNotification('Announcement created successfully!');

  cy.get('[data-testid="inActive-announcements"]').should('be.visible');
  cy.clickOutside();
};
