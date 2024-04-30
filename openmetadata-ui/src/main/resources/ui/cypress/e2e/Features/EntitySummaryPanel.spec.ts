/*
 *  Copyright 2024 Collate.
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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { SidebarItem } from '../../constants/Entity.interface';

describe('Entity Summary Panel', () => {
  beforeEach(() => {
    cy.login();
    interceptURL(
      'GET',
      '/api/v1/search/query?*&index=table_search_index*',
      'getTableEntity'
    );
    cy.sidebarClick(SidebarItem.EXPLORE);
    verifyResponseStatusCode('@getTableEntity', 200);
  });

  it('Table Entity', () => {
    cy.get('[data-testid="Type-label"]').should('be.visible');
    cy.get('[data-testid="Queries-label"]').should('be.visible');
    cy.get('[data-testid="Columns-label"]').should('be.visible');
    cy.get('[data-testid="profiler-header"]').should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="schema-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Database', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=database_search_index*',
      'getDatabaseEntity'
    );
    cy.get('[data-testid="databases-tab"]').click();
    verifyResponseStatusCode('@getDatabaseEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Owner-value"]').should('be.visible');
    cy.get('[data-testid="Tier-label"]').should('be.visible');
    cy.get('[data-testid="Service-label"]').should('be.visible');
    cy.get('[data-testid="Usage-label"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="schema-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Database schema', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=database_schema_search_index*',
      'getDatabaseSchemaEntity'
    );
    cy.get('[data-testid="database schemas-tab"]').click();
    verifyResponseStatusCode('@getDatabaseSchemaEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Owner-value"]').should('be.visible');
    cy.get('[data-testid="Tier-label"]').should('be.visible');
    cy.get('[data-testid="Service-label"]').should('be.visible');
    cy.get('[data-testid="Database-label"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="Usage-label"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Dashboard entity', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=dashboard_search_index*',
      'getDashboardEntity'
    );
    cy.get('[data-testid="dashboards-tab"]').click();
    verifyResponseStatusCode('@getDashboardEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Dashboard URL-label"]').should('be.visible');
    cy.get('[data-testid="Project-label"]').should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="charts-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Dashboard data model entity', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=dashboard_data_model_search_index*',
      'getDashboardDataModelEntity'
    );
    cy.get('[data-testid="dashboard data models-tab"]').click();
    verifyResponseStatusCode('@getDashboardDataModelEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Data Model URL-label"]').should('be.visible');
    cy.get('[data-testid="Service-label"]').should('be.visible');
    cy.get('[data-testid="Tier-label"]').should('be.visible');
    cy.get('[data-testid="Data Model Type-label"]').should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="column-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Pipeline entity', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=pipeline_search_index*',
      'getPipelineEntity'
    );
    cy.get('[data-testid="pipelines-tab"]').click();
    verifyResponseStatusCode('@getPipelineEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Pipeline URL-label"]').should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="tasks-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Topic entity', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=topic_search_index*',
      'getTopicEntity'
    );
    cy.get('[data-testid="topics-tab"]').click();
    verifyResponseStatusCode('@getTopicEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Partitions-label"]').should('be.visible');
    cy.get('[data-testid="Replication Factor-label"]').should('be.visible');
    cy.get('[data-testid="Retention Size-label"]').should('be.visible');
    cy.get('[data-testid="CleanUp Policies-label"]').should('be.visible');
    cy.get('[data-testid="Max Message Size-label"]').should('be.visible');
    cy.get('[data-testid="Schema Type-label"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="schema-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('ML Model entity', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=mlmodel_search_index*',
      'getMLModelEntity'
    );
    cy.get('[data-testid="ml models-tab"]').click();
    verifyResponseStatusCode('@getMLModelEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Algorithm-label"]').should('be.visible');
    cy.get('[data-testid="Target-label"]').should('be.visible');
    cy.get('[data-testid="Server-label"]').should('be.visible');
    cy.get('[data-testid="Dashboard-label"]').should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="features-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Container entity', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=container_search_index*',
      'getContainerEntity'
    );
    cy.get('[data-testid="containers-tab"]').click();
    verifyResponseStatusCode('@getContainerEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="Objects-label"]').should('be.visible');
    cy.get('[data-testid="Service Type-label"]').should('be.visible');
    cy.get('[data-testid="Columns-label"]').should('be.visible');
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="schema-header"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Search Index entity', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?*index=search_entity_search_index*',
      'getSearchIndexEntity'
    );
    cy.get('[data-testid="search indexes-tab"]').click();
    verifyResponseStatusCode('@getSearchIndexEntity', 200);
    cy.get('.ant-drawer-title > [data-testid="entity-link"]').should(
      'be.visible'
    );
    cy.get('[data-testid="tags-header"]').scrollIntoView().should('be.visible');
    cy.get('[data-testid="description-header"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="fields-header"]')
      .scrollIntoView()
      .should('be.visible');
  });
});
