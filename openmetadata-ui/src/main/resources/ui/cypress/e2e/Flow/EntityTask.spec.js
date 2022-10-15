/*
 *  Copyright 2021 Collate
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

import { interceptURL, login, verifyResponseStatusCode, visitEntityDetailsPage } from "../../common/common";
import { LOGIN, SEARCH_ENTITY_DASHBOARD, SEARCH_ENTITY_MLMODEL, SEARCH_ENTITY_PIPELINE, SEARCH_ENTITY_TABLE, SEARCH_ENTITY_TOPIC } from "../../constants/constants";

const TASK_ENTITIES=[SEARCH_ENTITY_TABLE.table_1,SEARCH_ENTITY_TOPIC.topic_1,SEARCH_ENTITY_DASHBOARD.dashboard_1,SEARCH_ENTITY_PIPELINE.pipeline_1,SEARCH_ENTITY_MLMODEL.mlmodel_1]

describe("Entity Tasks", () => {
  beforeEach(() => {
    login(LOGIN.username, LOGIN.password);
    cy.goToHomePage();
  });

 

  const addTagsTask = (value) => {
    const title = `Request tags for ${value.entity} ${value.term}`
    const assignee = "admin"
    const tag = "PII.Sensitive"
    
    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    interceptURL("GET",`/api/v1/${value.entity}/name/*`,'entityTask')

    cy.get('[data-testid="request-entity-tags"]').should('be.visible').click();

    verifyResponseStatusCode('@entityTask', 200);

    cy.get('[data-testid="breadcrumb"]').should("be.visible")
    
    cy.get('#title').should('be.visible').clear().type(title);
    
    
    cy.get('[data-testid="select-assignee"]').should('be.visible').type(assignee);
    cy.get('[data-testid="user-tag"]').should("be.visible").first().click()
    cy.get('body').click()
   
     cy.get('[data-testid="select-tags"]').should('be.visible').type(tag);
    cy.get('[data-testid="tag-option"]').should("be.visible").first().click()
    cy.get('body').click()

    interceptURL("GET","/api/v1/feed/tasks/*",'entityTaskDetail')

    cy.get('[data-testid="submit-tag-request"]')
      .should('be.visible')
      .contains('Suggest')
      .scrollIntoView()
      .click();
    
    verifyResponseStatusCode('@entityTaskDetail', 200);

    cy.get('[data-testid="task-title"]').should("be.visible").contains(title)
    cy.get('[data-testid="assignee"]').should("be.visible").contains(assignee)
    cy.get('[data-testid="request-tags"]').should("be.visible")
    cy.get('[data-testid="diff-added"]').should("be.visible").contains(tag)
    cy.get('[data-testid="complete-task"]').should("be.visible").contains("Accept Suggestion").scrollIntoView().click()
    
  };

  TASK_ENTITIES.forEach((entity) => {
    it(`Create task for ${entity.entity}`, () => {
      addTagsTask(entity)
    })
  })
})