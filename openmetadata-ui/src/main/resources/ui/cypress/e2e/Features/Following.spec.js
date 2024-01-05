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
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  createEntityTable,
  createSingleLevelEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import {
  DASHBOARD_DATA_MODEL_DETAILS,
  DATABASE_SERVICE,
  SINGLE_LEVEL_SERVICE,
  STORED_PROCEDURE_DETAILS,
  VISIT_ENTITIES_DATA,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

// Update list if we support this for other entities too
const FOLLOWING_ENTITIES = [
  VISIT_ENTITIES_DATA.table,
  VISIT_ENTITIES_DATA.dashboard,
  VISIT_ENTITIES_DATA.topic,
  VISIT_ENTITIES_DATA.pipeline,
  VISIT_ENTITIES_DATA.mlmodel,
  VISIT_ENTITIES_DATA.storedProcedure,
  VISIT_ENTITIES_DATA.dataModel,
];

const followEntity = ({ term, serviceName, entity }, isUnfollow) => {
  visitEntityDetailsPage({ term, serviceName, entity });

  if (entity === 'dashboardDataModel') {
    interceptURL(
      isUnfollow ? 'DELETE' : 'PUT',
      isUnfollow
        ? '/api/v1/dashboard/datamodels/*/followers/*'
        : '/api/v1/dashboard/datamodels/*/followers',
      'waitAfterFollow'
    );
  } else {
    interceptURL(
      isUnfollow ? 'DELETE' : 'PUT',
      isUnfollow ? '/api/v1/*/*/followers/*' : '/api/v1/*/*/followers',
      'waitAfterFollow'
    );
  }

  interceptURL(
    isUnfollow ? 'DELETE' : 'PUT',
    isUnfollow ? '/api/v1/*/*/followers/*' : '/api/v1/*/*/followers',
    'waitAfterFollow'
  );
  cy.get('[data-testid="entity-follow-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  verifyResponseStatusCode('@waitAfterFollow', 200);
};

describe('Following data assets', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });
      SINGLE_LEVEL_SERVICE.forEach((data) => {
        createSingleLevelEntity({
          token,
          ...data,
          entity: [data.entity],
        });
      });

      // creating data model
      cy.request({
        method: 'POST',
        url: `/api/v1/dashboard/datamodels`,
        headers: { Authorization: `Bearer ${token}` },
        body: DASHBOARD_DATA_MODEL_DETAILS,
      });
      // creating stored procedure
      cy.request({
        method: 'POST',
        url: `/api/v1/storedProcedures`,
        headers: { Authorization: `Bearer ${token}` },
        body: STORED_PROCEDURE_DETAILS,
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
      SINGLE_LEVEL_SERVICE.forEach((data) => {
        hardDeleteService({
          token,
          serviceFqn: data.service.name,
          serviceType: data.serviceType,
        });
      });
    });
  });

  beforeEach(() => {
    cy.login();
    cy.get("[data-testid='welcome-screen-close-btn']").click();
  });

  it('following section should be present', () => {
    cy.get('[data-testid="following-widget"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="following-widget"]').contains(
      'You have not followed anything yet.'
    );
    cy.get(`[data-testid="following-widget"] .right-panel-list-item`).should(
      'have.length',
      0
    );
  });

  // Follow entity
  FOLLOWING_ENTITIES.map((entity, index) => {
    it(`following section should have ${entity.term} followed`, () => {
      followEntity(entity);

      interceptURL(
        'GET',
        '/api/v1/feed?type=Announcement&activeAnnouncement=true',
        'getAnnoucemenets'
      );

      cy.clickOnLogo();
      verifyResponseStatusCode('@getAnnoucemenets', 200);

      if (index < 5) {
        cy.get(`[data-testid="following-${entity.displayName}"]`).should(
          'be.visible'
        );
      }

      // Checking count of following
      cy.get(`[data-testid="following-data"]`).should('contain', index + 1);
    });
  });

  // UnFollow entity
  FOLLOWING_ENTITIES.map((entity, index) => {
    it(`unfollowing entity ${entity.term} should removed from following section`, () => {
      followEntity(entity, true);

      interceptURL(
        'GET',
        '/api/v1/feed?type=Announcement&activeAnnouncement=true',
        'getAnnoucemenets'
      );

      cy.clickOnLogo();
      verifyResponseStatusCode('@getAnnoucemenets', 200);

      cy.get(`[data-testid="following-${entity.displayName}"]`).should(
        'not.exist'
      );

      if (index === FOLLOWING_ENTITIES.length - 1) {
        // Checking count of following
        cy.get(`[data-testid="following-data"]`).should('not.exist');
      } else {
        // Checking count of following
        cy.get(`[data-testid="following-data"]`).should(
          'contain',
          FOLLOWING_ENTITIES.length - (index + 1)
        );
      }
    });
  });
});
