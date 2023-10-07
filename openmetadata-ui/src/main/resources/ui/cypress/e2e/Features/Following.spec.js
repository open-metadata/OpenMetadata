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
  SEARCH_ENTITY_DASHBOARD,
  SEARCH_ENTITY_DATA_MODEL,
  SEARCH_ENTITY_MLMODEL,
  SEARCH_ENTITY_PIPELINE,
  SEARCH_ENTITY_STORED_PROCEDURE,
  SEARCH_ENTITY_TABLE,
  SEARCH_ENTITY_TOPIC,
} from '../../constants/constants';

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

// Update list if we support this for other entities too
const FOLLOWING_ENTITIES = [
  SEARCH_ENTITY_TABLE.table_2,
  SEARCH_ENTITY_DASHBOARD.dashboard_1,
  SEARCH_ENTITY_TOPIC.topic_1,
  SEARCH_ENTITY_PIPELINE.pipeline_1,
  SEARCH_ENTITY_MLMODEL.mlmodel_2,
  SEARCH_ENTITY_STORED_PROCEDURE.stored_procedure_2,
  SEARCH_ENTITY_DATA_MODEL.data_model_2,
];

const followEntity = ({ term, serviceName, entity }, isUnfollow) => {
  visitEntityDetailsPage(term, serviceName, entity);

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
  beforeEach(() => {
    cy.login();
    cy.get("[data-testid='welcome-screen-close-btn']").click();
  });

  it('following section should be present', () => {
    cy.get('[data-testid="following-data-container"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="following-data-container"]').contains(
      'You have not followed anything yet.'
    );
    cy.get(
      `[data-testid="following-data-container"] .right-panel-list-item`
    ).should('have.length', 0);
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

      cy.get(`[data-testid="following-${entity.displayName}"]`).should(
        'be.visible'
      );

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
