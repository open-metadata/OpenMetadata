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
import {
  EntityType,
  EXPLORE_PAGE_TABS,
  SEARCH_INDEX,
} from '../../constants/Entity.interface';
import {
  ENTITIES_WITHOUT_FOLLOWING_BUTTON,
  LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT,
  LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED,
} from '../../constants/SoftDeleteFlow.constants';
import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

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

        cy.get(`[data-testid="${id}"] [data-testid="entity-link"]`)
          .scrollIntoView()
          .click();
      }
    });

    verifyResponseStatusCode('@getEntityDetails', 200);
    cy.get('body').click(1, 1);
    cy.get('[data-testid="searchBox"]').clear();
  });
};

export const checkCustomPropertyEditButton = ({ deleted }) => {
  interceptURL(
    'GET',
    `/api/v1/metadata/types/name/*fields=customProperties*`,
    'getCustomProperties'
  );

  cy.get('[data-testid="custom_properties"]').click();

  verifyResponseStatusCode('@getCustomProperties', 200);

  if (!deleted) {
    cy.get(
      `[data-row-key="${'CUSTOM_ATTRIBUTE_NAME'}"] [data-testid="edit-icon"]`
    )
      .scrollIntoView()
      .should(`be.visible`);
  } else {
    cy.get(
      `[data-row-key="${'CUSTOM_ATTRIBUTE_NAME'}"] [data-testid="edit-icon"]`
    ).should(`not.exist`);
  }
};

export const checkLineageTabActions = ({ deleted }) => {
  interceptURL(
    'GET',
    `/api/v1/lineage/*/name/*?upstreamDepth=1&downstreamDepth=1*`,
    'getLineageData'
  );

  cy.get('[data-testid="lineage"]').click();

  !deleted && verifyResponseStatusCode('@getLineageData', 200);

  if (!deleted) {
    cy.get('[data-testid="edit-lineage"]').should('be.visible');
  } else {
    cy.get('[data-testid="no-data-placeholder"]').should(
      'contain',
      'Lineage data is not available for deleted entities.'
    );
  }
};

export const checkForEditActions = ({ entityType, deleted }) => {
  LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED.filter(({ elementSelector }) => {
    if (elementSelector === '[data-testid="entity-follow-button"]') {
      return !ENTITIES_WITHOUT_FOLLOWING_BUTTON.includes(entityType);
    }

    return !entityType.startsWith('services/');
  }).map(({ containerSelector, elementSelector }) => {
    cy.get(`${containerSelector} ${elementSelector}`).should(
      `${!deleted ? 'not.' : ''}be.disabled`
    );
  });

  LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT.map(
    ({ containerSelector, elementSelector }) => {
      if (!deleted) {
        cy.get(`${containerSelector} ${elementSelector}`)
          .scrollIntoView()
          .should('be.visible');
      } else {
        cy.get(`${containerSelector} ${elementSelector}`).should('not.exist');
      }
    }
  );

  //   checkCustomPropertyEditButton({ deleted });
};

export const checkForTableSpecificFields = ({ deleted }) => {
  interceptURL('GET', `/api/v1/queries*`, 'getQueryData');

  cy.get('[data-testid="table_queries"]').click();

  verifyResponseStatusCode('@getQueryData', 200);

  if (!deleted) {
    cy.get('[data-testid="add-query-btn"]').should('be.enabled');
  } else {
    cy.get('[data-testid="no-data-placeholder"]').should(
      'contain',
      'Queries data is not available for deleted entities.'
    );
  }

  interceptURL('GET', `/api/v1/tables/*/systemProfile*`, 'getSystemProfile');

  cy.get('[data-testid="profiler"]').click();

  verifyResponseStatusCode('@getSystemProfile', 200);

  cy.get('[data-testid="profiler-add-table-test-btn"]').should(
    !deleted ? 'be.visible' : 'not.exist'
  );
  cy.get('[data-testid="profiler-setting-btn"]').should(
    !deleted ? 'be.visible' : 'not.exist'
  );
};

export const deletedEntityCommonChecks = ({
  entityType,
  deleted,
}: {
  entityType: EntityType;
  deleted?: boolean;
}) => {
  const isTableEntity = entityType === EntityType.Table;

  // Go to first tab before starts validating
  cy.get('.ant-tabs-tab').first().click();

  // Check if all the edit actions are available for the entity
  checkForEditActions({
    entityType,
    deleted,
  });

  if (isTableEntity) {
    checkLineageTabActions({ deleted });
  }

  if (isTableEntity) {
    checkForTableSpecificFields({ deleted });
  }

  cy.get('[data-testid="manage-button"]').click();

  if (deleted) {
    // only two menu options (restore and delete) should be present
    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="announcement-button"]'
    ).should('not.exist');
    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
    ).should('not.exist');
    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="profiler-setting-button"]'
    ).should('not.exist');
    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="restore-button"]'
    ).should('be.visible');
    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="delete-button"]'
    ).should('be.visible');
  } else {
    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="announcement-button"]'
    ).should('exist');
    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
    ).should('exist');
    [EntityType.Database, EntityType.DatabaseSchema].includes(entityType) &&
      cy
        .get(
          '[data-testid="manage-dropdown-list-container"] [data-testid="profiler-setting-button"]'
        )
        .should('exist');

    cy.get(
      '[data-testid="manage-dropdown-list-container"] [data-testid="delete-button"]'
    ).should('be.visible');
  }
  cy.clickOutside();
};

export const restoreEntity = () => {
  cy.get('[data-testid="deleted-badge"]').should('be.visible');
  cy.get('[data-testid="manage-button"]').click();
  cy.get('[data-testid="restore-button"]').click();

  cy.get('[type="button"]').contains('Restore').click();
  toastNotification('restored successfully');

  cy.get('[data-testid="deleted-badge"]').should('not.exist');
};

export const deleteEntity = (entityName: string, endPoint: EntityType) => {
  deletedEntityCommonChecks({ entityType: endPoint, deleted: false });

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

  cy.reload();
  cy.get('[data-testid="deleted-badge"]').should('have.text', 'Deleted');

  deletedEntityCommonChecks({ entityType: endPoint, deleted: true });

  restoreEntity();
  cy.reload();

  deletedEntityCommonChecks({ entityType: endPoint, deleted: false });
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
