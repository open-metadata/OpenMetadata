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
  addAnnouncement,
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { ANNOUNCEMENT_ENTITIES } from '../../constants/constants';

describe('Entity Announcement', () => {
  beforeEach(() => {
    cy.login();
  });

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
      visitEntityDetailsPage({
        term: value.term,
        serviceName: value.serviceName,
        entity: value.entity,
      });
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
