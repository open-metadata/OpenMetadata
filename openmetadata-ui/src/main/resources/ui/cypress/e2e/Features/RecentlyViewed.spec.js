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
  SEARCH_ENTITY_MLMODEL,
  SEARCH_ENTITY_PIPELINE,
  SEARCH_ENTITY_STORED_PROCEDURE,
  SEARCH_ENTITY_TABLE,
  SEARCH_ENTITY_TOPIC,
} from '../../constants/constants';

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

// Update list if we support this for other entities too
const RECENTLY_VIEW_ENTITIES = [
  SEARCH_ENTITY_TABLE.table_2,
  SEARCH_ENTITY_DASHBOARD.dashboard_1,
  SEARCH_ENTITY_TOPIC.topic_1,
  SEARCH_ENTITY_PIPELINE.pipeline_1,
  SEARCH_ENTITY_MLMODEL.mlmodel_2,
  SEARCH_ENTITY_STORED_PROCEDURE.stored_procedure_2,
];

describe('Recently viwed data assets', () => {
  beforeEach(() => {
    cy.login();
    cy.get("[data-testid='welcome-screen-close-btn']").click();
  });

  it('recently view section should be present', () => {
    cy.get('[data-testid="recently-viewed-container"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get(
      `[data-testid="recently-viewed-container"] .right-panel-list-item`
    ).should('have.length', 0);
  });

  it(`recently view section should have at max list of 5 entity`, () => {
    RECENTLY_VIEW_ENTITIES.map((entity, index) => {
      visitEntityDetailsPage({
        term: entity.term,
        serviceName: entity.serviceName,
        entity: entity.entity,
      });

      interceptURL(
        'GET',
        '/api/v1/feed?type=Announcement&activeAnnouncement=true',
        'getAnnouncements'
      );

      cy.clickOnLogo();
      verifyResponseStatusCode('@getAnnouncements', 200);

      // need to add manual wait as we are dependant on local storage for recently view data
      cy.wait(500);
      cy.get('[data-testid="recently-viewed-container"]')
        .scrollIntoView()
        .should('be.visible');
      cy.get(
        `[data-testid="recently-viewed-container"] [title="${entity.displayName}"]`
      )
        .scrollIntoView()
        .should('be.visible');

      // Checking count since we will only show max 5 not more than that
      cy.get(
        `[data-testid="recently-viewed-container"] .right-panel-list-item`
      ).should('have.length', index + 1);
    });
  });
});
