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
import { DELETE_TERM } from '../../constants/constants';
import { EntityType } from '../../new-tests/base/EntityClass';
import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

const EXPLORE_PAGE_TABS: Record<
  Exclude<
    EntityType,
    | EntityType.DashboardService
    | EntityType.DatabaseService
    | EntityType.MessagingService
    | EntityType.SearchService
    | EntityType.MlModelService
    | EntityType.StorageService
    | EntityType.PipelineService
    | EntityType.Database
    | EntityType.DatabaseSchema
    | EntityType.GlossaryTerm
  >,
  string
> = {
  [EntityType.Dashboard]: 'Dashboard',
  [EntityType.DataModel]: 'dashboard data models',
  [EntityType.Pipeline]: 'Pipeline',
  [EntityType.Topic]: 'Topic',
  [EntityType.MlModel]: 'ML Model',
  [EntityType.Container]: 'Container',
  [EntityType.SeachIndex]: 'Search Index',
  [EntityType.Table]: 'Table',
  [EntityType.StoreProcedure]: 'Store Procedure',
  [EntityType.Glossary]: 'Glossary',
  [EntityType.Domain]: 'Domain',
};

export const SEARCH_INDEX: Record<
  Exclude<
    EntityType,
    | EntityType.DashboardService
    | EntityType.DatabaseService
    | EntityType.MessagingService
    | EntityType.SearchService
    | EntityType.MlModelService
    | EntityType.StorageService
    | EntityType.PipelineService
    | EntityType.Database
    | EntityType.DatabaseSchema
    | EntityType.GlossaryTerm
  >,
  string
> = {
  [EntityType.Dashboard]: 'dashboard_search_index',
  [EntityType.DataModel]: 'dashboard_data_model_search_index',
  [EntityType.Pipeline]: 'pipeline_search_index',
  [EntityType.Topic]: 'topic_search_index',
  [EntityType.MlModel]: 'mlmodel_search_index',
  [EntityType.Container]: 'container_search_index',
  [EntityType.SeachIndex]: 'search_entity_search_index',
  [EntityType.Table]: 'table_search_index',
  [EntityType.StoreProcedure]: 'store_procedure_search_index',
  [EntityType.Glossary]: 'glossary_search_index',
  [EntityType.Domain]: 'domain_search_index',
};

/**
 * create full hierarchy of database service (service > database > schema > tables)
 */
export const createEntityTableViaREST = ({
  service,
  database,
  schema,
  tables,
  storeProcedure,
  token,
}: {
  service: Cypress.RequestBody;
  database: Cypress.RequestBody;
  schema?: Cypress.RequestBody;
  tables: Cypress.RequestBody[];
  storeProcedure?: Cypress.RequestBody;
  token: Cypress.Storable;
}) => {
  const createdEntityIds = {
    databaseId: undefined,
    databaseSchemaId: undefined,
  };

  // Create service
  cy.request({
    method: 'POST',
    url: `/api/v1/services/databaseServices`,
    headers: { Authorization: `Bearer ${token}` },
    body: service,
  }).then((response) => {
    expect(response.status).to.eq(201);
  });

  // Create Database
  cy.request({
    method: 'POST',
    url: `/api/v1/databases`,
    headers: { Authorization: `Bearer ${token}` },
    body: database,
  }).then((response) => {
    expect(response.status).to.eq(201);

    createdEntityIds.databaseId = response.body.id;
  });

  // Create Database Schema
  schema &&
    cy
      .request({
        method: 'POST',
        url: `/api/v1/databaseSchemas`,
        headers: { Authorization: `Bearer ${token}` },
        body: schema,
      })
      .then((response) => {
        expect(response.status).to.eq(201);

        createdEntityIds.databaseSchemaId = response.body.id;
      });

  storeProcedure &&
    cy
      .request({
        method: 'POST',
        url: `/api/v1/storedProcedures`,
        headers: { Authorization: `Bearer ${token}` },
        body: storeProcedure,
      })
      .then((response) => {
        expect(response.status).to.eq(201);
      });

  tables.forEach((body) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/tables`,
      headers: { Authorization: `Bearer ${token}` },
      body,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  return createdEntityIds;
};

export const createEntityViaREST = ({
  body,
  endPoint,
  token,
}: {
  body: Cypress.RequestBody;
  endPoint: EntityType;
  token: Cypress.Storable;
}) => {
  // Create entity
  cy.request({
    method: 'POST',
    url: `/api/v1/${endPoint}`,
    headers: { Authorization: `Bearer ${token}` },
    body: body,
  }).then((response) => {
    expect(response.status).to.eq(201);
  });
};

export const deleteEntityViaREST = ({
  entityName,
  endPoint,
  token,
}: {
  entityName: string;
  endPoint: EntityType;
  token: Cypress.Storable;
}) => {
  // Create entity
  cy.request({
    method: 'DELETE',
    url: `/api/v1/${endPoint}/name/${entityName}?recursive=true&hardDelete=true`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    expect(response.status).to.eq(200);
  });
};

export const visitEntityDetailsPage = ({
  term,
  serviceName,
  entity,
  dataTestId,
  entityType,
  entityFqn,
}: {
  term: string;
  serviceName: string;
  entity: EntityType;
  dataTestId?: string;
  entityType?: EntityType;
  entityFqn?: string;
}) => {
  if (entity === EntityType.DataModel) {
    interceptURL(
      'GET',
      '/api/v1/dashboard/datamodels/name/*',
      'getEntityDetails'
    );
  } else {
    interceptURL('GET', '/api/v1/*/name/*', 'getEntityDetails');
  }

  interceptURL(
    'GET',
    `/api/v1/search/query?q=**&index=${SEARCH_INDEX[entity]}&from=*&size=**`,
    'explorePageTabSearch'
  );
  interceptURL(
    'GET',
    `/api/v1/search/query?q=**&from=*&size=*&index=all`,
    'explorePageSearch'
  );
  const id = dataTestId ?? `${serviceName}-${term}`;

  if (entityType) {
    cy.get('[data-testid="global-search-selector"]').click();
    cy.get(`[data-testid="global-search-select-option-${entityType}"]`).click();
  }

  // searching term in search box
  cy.get('[data-testid="searchBox"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="searchBox"]').type(entityFqn ?? term);
  cy.wait('@explorePageSearch').then(() => {
    cy.get('body').then(($body) => {
      // checking if requested term is available in search suggestion
      if (
        $body.find(`[data-testid="${id}"] [data-testid="data-name"]`).length
      ) {
        // if term is available in search suggestion, redirecting to entity details page
        cy.get(`[data-testid="${id}"] [data-testid="data-name"]`)
          .first()
          .click();
      } else {
        // if term is not available in search suggestion,
        // hitting enter to search box so it will redirect to explore page
        cy.get('body').click(1, 1);
        cy.get('[data-testid="searchBox"]').type('{enter}');
        verifyResponseStatusCode('@explorePageSearch', 200);

        const tabName = EXPLORE_PAGE_TABS?.[entity] ?? entity;

        cy.get(`[data-testid="${tabName}-tab"]`).click();

        verifyResponseStatusCode('@explorePageTabSearch', 200);

        verifyResponseStatusCode('@explorePageSearch', 200);
        if ([EntityType.Dashboard, EntityType.DataModel].includes(entity)) {
          cy.get('[data-testid="search-dropdown-Service"]').click();
          cy.get(
            '[data-testid="drop-down-menu"] [data-testid="search-input"]'
          ).type(serviceName);
          verifyResponseStatusCode('@explorePageSearch', 200);
          cy.get(
            `[data-testid="drop-down-menu"] [data-testid="${serviceName}"]`
          ).click();
          cy.get(
            `[data-testid="drop-down-menu"] [data-testid="update-btn"]`
          ).click();
          cy.get('[data-testid="entity-link"]').contains(term).eq(0).click();
        } else {
          cy.get(`[data-testid="${id}"] [data-testid="entity-link"]`)
            .scrollIntoView()
            .click();
        }
      }
    });

    verifyResponseStatusCode('@getEntityDetails', 200);
    cy.get('body').click(1, 1);
    cy.get('[data-testid="searchBox"]').clear();
  });
};

export const deleteEntity = (entityName: string, endPoint: EntityType) => {
  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="delete-button"]').scrollIntoView().click();
  cy.get('[data-testid="delete-modal"]').then(() => {
    cy.get('[role="dialog"]').should('be.visible');
  });

  cy.get('[data-testid="delete-modal"] .ant-modal-title').should(
    'contain',
    `Delete ${entityName}`
  );

  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

  interceptURL(
    'DELETE',
    `/api/v1/${endPoint}/*?hardDelete=false&recursive=true`,
    'deleteEntity'
  );

  cy.get('[data-testid="confirm-button"]').click();

  verifyResponseStatusCode('@deleteEntity', 200);

  toastNotification('deleted successfully!');

  cy.get('[data-testid="deleted-badge"]').should('have.text', 'Deleted');
};

export const restoreEntity = () => {
  //   cy.get('[data-testid="app-bar-item-explore"]').click();
  //   cy.get('[data-testid="show-deleted"]').click();
  //   cy.get(`[data-testid="entity-header-display-name"]`)
  //     .contains(entityName)
  //     .click();
  cy.reload();
  cy.get('[data-testid="deleted-badge"]').should('be.visible');
  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="restore-button"]').click();

  cy.get('[type="button"]').contains('Restore').click();
  toastNotification('restored successfully');

  cy.get('[data-testid="deleted-badge"]').should('not.exist');
};

export const hardDeleteEntity = (entityName: string, endPoint: EntityType) => {
  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="delete-button"]').scrollIntoView().click();
  cy.get('[data-testid="delete-modal"]').then(() => {
    cy.get('[role="dialog"]').should('be.visible');
  });

  cy.get('[data-testid="delete-modal"] .ant-modal-title').should(
    'contain',
    `Delete ${entityName}`
  );

  cy.get('[data-testid="hard-delete-option"]').click();
  cy.get('[data-testid="hard-delete"]').check();

  cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

  interceptURL(
    'DELETE',
    `/api/v1/${endPoint}/*?hardDelete=true&recursive=true`,
    'deleteEntity'
  );

  cy.get('[data-testid="confirm-button"]').click();

  verifyResponseStatusCode('@deleteEntity', 200);

  toastNotification('deleted successfully!');
};

export const updateDisplayNameForEntity = (
  displayName: string,
  endPoint: EntityType
) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'patchDisplayName');

  cy.get('[data-testid="manage-button"]').click();

  cy.get('[data-testid="rename-button"]').click();

  cy.get('#name').should('be.visible').should('be.disabled');
  cy.get('#displayName').should('be.visible').should('not.be.disabled').clear();
  cy.get('.ant-modal-footer').should('contain', 'Cancel');
  cy.get('#displayName').type(displayName);
  cy.get('[data-testid="save-button"]').click();

  verifyResponseStatusCode('@patchDisplayName', 200);

  cy.get('[data-testid="entity-header-display-name"]').should(
    'contain',
    displayName
  );
};

export const updateDescriptioForEntity = (
  description: string,
  endPoint: EntityType
) => {
  interceptURL('PATCH', `/api/v1/${endPoint}/*`, 'updateEntity');
  cy.get('[data-testid="edit-description"]').click();

  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .click()
    .clear()
    .type(description);

  cy.get('[data-testid="save"]').click();

  verifyResponseStatusCode('@updateEntity', 200);

  cy.get(
    '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
  ).should('contain', description);
};
