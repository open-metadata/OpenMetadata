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

import { visitEntityDetailsPage } from '../../common/common';
import {
  SEARCH_ENTITY_PIPELINE,
  SEARCH_ENTITY_TABLE,
  SEARCH_ENTITY_TOPIC,
} from '../../constants/constants';

const tableEntity = SEARCH_ENTITY_TABLE.table_1;
const topicEntity = SEARCH_ENTITY_TOPIC.topic_1;
const pipelineEntity = SEARCH_ENTITY_PIPELINE.pipeline_1;
// Todo:- skipping flaky test
// const dashboardEntity = SEARCH_ENTITY_DASHBOARD.dashboard_1;

const ENTITIES_LIST = [
  tableEntity,
  topicEntity,
  pipelineEntity,
  // dashboardEntity,
];

describe('Entity Details Page', () => {
  beforeEach(() => {
    cy.login();
  });

  ENTITIES_LIST.map((entity) => {
    it(`Edit lineage should work for ${entity.entity} entity`, () => {
      visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);
      cy.get('[data-testid="Lineage"]').should('be.visible').click();

      // Check edit button should not be disabled
      cy.get('[data-testid="edit-lineage"]')
        .should('be.visible')
        .should('not.be.disabled');
    });
  });
});
