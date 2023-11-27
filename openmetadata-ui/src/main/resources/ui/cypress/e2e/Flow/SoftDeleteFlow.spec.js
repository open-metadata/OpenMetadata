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

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

import {
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitDatabaseDetailsPage,
  visitDatabaseSchemaDetailsPage,
  visitEntityDetailsPage,
  visitServiceDetailsPage,
} from '../../common/common';
import {
  createCustomAttribute,
  deleteCustomAttribute,
} from '../../common/CustomPropertyUtils';
import {
  createEntityTable,
  createSingleLevelEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import {
  deletedTeamChecks,
  nonDeletedTeamChecks,
  softDeletedEntityCommonChecks,
} from '../../common/SoftDeleteFlowUtils';
import { createTeams, deleteTeam } from '../../common/TeamsUtils';
import {
  DASHBOARD_DATA_MODEL_DETAILS,
  STORED_PROCEDURE_DETAILS,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';
import {
  ALL_SERVICES_SOFT_DELETE_TEST,
  CUSTOM_ATTRIBUTE_ASSETS_SOFT_DELETE_TEST,
  CUSTOM_ATTRIBUTE_NAME,
  DATABASE_SCHEMA_SOFT_DELETE_TEST,
  DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST,
  DATABASE_SERVICE_SOFT_DELETE_TEST,
  DATABASE_SOFT_DELETE_TEST,
  OMIT_SERVICE_CREATION_FOR_ENTITIES,
  POLICY_NAME,
  ROLE_NAME,
  SINGLE_LEVEL_SERVICE_SOFT_DELETE_TEST,
  TEAM_1_DETAILS_SOFT_DELETE_TEST,
  TEAM_1_NAME,
  TEAM_2_DETAILS_SOFT_DELETE_TEST,
} from '../../constants/SoftDeleteFlow.constants';

describe(`Soft delete flow should work for all entities`, () => {
  let createdEntityIds;

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      CUSTOM_ATTRIBUTE_ASSETS_SOFT_DELETE_TEST.forEach(
        ({ entitySchemaName }) => {
          if (entitySchemaName) {
            createCustomAttribute({
              name: CUSTOM_ATTRIBUTE_NAME,
              serviceType: entitySchemaName,
              token,
            });
          }
        }
      );

      const ids = createEntityTable({
        token,
        ...DATABASE_SERVICE_SOFT_DELETE_TEST,
        tables: [DATABASE_SERVICE_SOFT_DELETE_TEST.entity],
      });

      createdEntityIds = ids;

      SINGLE_LEVEL_SERVICE_SOFT_DELETE_TEST.filter(
        (data) => !OMIT_SERVICE_CREATION_FOR_ENTITIES.includes(data.entityType)
      ).forEach((data) => {
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

      createTeams({
        token,
        team1: TEAM_1_DETAILS_SOFT_DELETE_TEST,
        team2: TEAM_2_DETAILS_SOFT_DELETE_TEST,
        policyName: POLICY_NAME,
        roleName: ROLE_NAME,
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  ALL_SERVICES_SOFT_DELETE_TEST.map(
    ({ service, entity, entityType, firstTabKey, entitySchemaName }) => {
      it(`Soft delete flow should work properly for ${entityType}`, () => {
        visitEntityDetailsPage({
          term: entity.name,
          serviceName: service.name,
          entity: entityType,
        });

        softDeletedEntityCommonChecks({
          entityType,
          firstTabKey,
          entitySchemaName,
          isLineageTabPresent: true,
        });
      });
    }
  );

  it(`Soft delete flow should work properly for database schemas`, () => {
    visitDatabaseSchemaDetailsPage({
      settingsMenuId: DATABASE_SCHEMA_SOFT_DELETE_TEST.settingsMenuId,
      serviceCategory: DATABASE_SCHEMA_SOFT_DELETE_TEST.serviceCategory,
      serviceName: DATABASE_SCHEMA_SOFT_DELETE_TEST.serviceName,
      databaseRowKey: createdEntityIds.databaseId,
      databaseName: DATABASE_SCHEMA_SOFT_DELETE_TEST.databaseName,
      databaseSchemaRowKey: createdEntityIds.databaseSchemaId,
      databaseSchemaName: DATABASE_SCHEMA_SOFT_DELETE_TEST.databaseSchemaName,
    });

    softDeletedEntityCommonChecks({
      entityType: 'databaseSchemas',
      firstTabKey: 'table',
      isLineageTabPresent: false,
      entitySchemaName: DATABASE_SCHEMA_SOFT_DELETE_TEST.entitySchemaName,
    });
  });

  it(`Soft delete flow should work properly for databases`, () => {
    visitDatabaseDetailsPage({
      settingsMenuId: DATABASE_SOFT_DELETE_TEST.settingsMenuId,
      serviceCategory: DATABASE_SOFT_DELETE_TEST.serviceCategory,
      serviceName: DATABASE_SOFT_DELETE_TEST.serviceName,
      databaseRowKey: createdEntityIds.databaseId,
      databaseName: DATABASE_SOFT_DELETE_TEST.databaseName,
    });

    softDeletedEntityCommonChecks({
      entityType: 'databases',
      firstTabKey: 'schema',
      isLineageTabPresent: false,
      entitySchemaName: DATABASE_SOFT_DELETE_TEST.entitySchemaName,
    });
  });

  it(`Soft delete flow should work properly for services`, () => {
    visitServiceDetailsPage(
      DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST.settingsMenuId,

      DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST.serviceCategory,
      DATABASE_SERVICE_DETAILS_SOFT_DELETE_TEST.serviceName
    );

    softDeletedEntityCommonChecks({
      entityType: 'services/databaseServices',
      firstTabKey: 'databases',
      isLineageTabPresent: false,
    });
  });

  it('Soft delete flow should work properly for teams', () => {
    interceptURL(
      'GET',
      `/api/v1/teams?*parentTeam=Organization*`,
      'getAllTeams'
    );

    cy.get('[data-testid="app-bar-item-settings"]').click();

    verifyResponseStatusCode('@getAllTeams', 200);

    interceptURL(
      'GET',
      `/api/v1/teams*parentTeam=${TEAM_1_NAME}*`,
      'getChildTeams'
    );

    cy.get(`[data-row-key="${TEAM_1_NAME}"]`)
      .contains(`${TEAM_1_NAME}`)
      .click();

    verifyResponseStatusCode('@getChildTeams', 200);

    cy.get('[data-testid="team-details-collapse"] .ant-collapse-arrow')
      .scrollIntoView()
      .click({ waitForAnimations: true });

    // Check if edit actions are enabled for the team
    nonDeletedTeamChecks();

    // Soft Delete team
    cy.get('[data-testid="manage-button"]').scrollIntoView().click();
    cy.get('[data-testid="import-button-title"]').should('be.visible');
    cy.get('[data-testid="export-title"]').should('be.visible');
    cy.get('[data-testid="open-group-label"]').should('be.visible');
    cy.get('[data-testid="delete-button-title"]').click();
    cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
    cy.get('[data-testid="confirm-button"]').click();

    toastNotification('Team deleted successfully!');

    // Checks if soft deleted team has all edit actions disabled
    deletedTeamChecks();

    // Restore team
    cy.get('[data-testid="manage-button"]').click();
    cy.get('[data-testid="restore-team-dropdown-title"]').click();

    toastNotification('Team restored successfully');

    // Edit team actions should be enabled again after entity restored
    nonDeletedTeamChecks();
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE_SOFT_DELETE_TEST.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
      SINGLE_LEVEL_SERVICE_SOFT_DELETE_TEST.filter(
        (data) => !OMIT_SERVICE_CREATION_FOR_ENTITIES.includes(data.entityType)
      ).forEach((data) => {
        hardDeleteService({
          token,
          serviceFqn: data.service.name,
          serviceType: data.serviceType,
        });
      });
      CUSTOM_ATTRIBUTE_ASSETS_SOFT_DELETE_TEST.forEach(
        ({ entitySchemaName }) => {
          if (entitySchemaName) {
            deleteCustomAttribute({
              name: CUSTOM_ATTRIBUTE_NAME,
              serviceType: entitySchemaName,
              token,
            });
          }
        }
      );

      deleteTeam({ token, teamName: TEAM_1_NAME });
    });
  });
});
