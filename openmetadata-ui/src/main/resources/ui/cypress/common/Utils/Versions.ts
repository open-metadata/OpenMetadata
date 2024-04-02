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
import { EntityType } from '../../constants/Entity.interface';
import { DOMAIN_CREATION_DETAILS } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';
import {
  COMMON_PATCH_PAYLOAD,
  DATABASE_DETAILS_FOR_VERSION_TEST,
  DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST,
  OWNER_DETAILS,
  SERVICE_DETAILS_FOR_VERSION_TEST,
} from '../../constants/Version.constants';
import { interceptURL, verifyResponseStatusCode } from '../common';
import { deleteEntityViaREST } from './Entity';

interface EntityReference {
  id?: string;
  name?: string;
  displayName?: string;
  fullyQualifiedName?: string;
}

const serviceDetails = SERVICE_DETAILS_FOR_VERSION_TEST.Database;

interface EntityCreationData {
  user?: EntityReference;
  domain?: EntityReference;
  database?: EntityReference;
  schema?: EntityReference;
}

export const validateDomain = (domain: string, entityType: EntityType) => {
  interceptURL('GET', `/api/v1/${entityType}/*/versions/0.2`, 'getVersion');
  cy.get('[data-testid="version-button"]').should('contain', '0.2').click();
  verifyResponseStatusCode('@getVersion', 200);
};

export const commonPrerequisites = (
  token: string,
  data: EntityCreationData
) => {
  // Create user
  cy.request({
    method: 'POST',
    url: `/api/v1/users/signup`,
    headers: { Authorization: `Bearer ${token}` },
    body: OWNER_DETAILS,
  }).then((response) => {
    data.user = response.body;
  });

  cy.request({
    method: 'PUT',
    url: `/api/v1/domains`,
    headers: { Authorization: `Bearer ${token}` },
    body: DOMAIN_CREATION_DETAILS,
  }).then((response) => {
    data.domain = response.body;
  });
};

export const commonTestCleanup = (token: string, data: EntityCreationData) => {
  deleteEntityViaREST({
    token,
    endPoint: EntityType.Domain,
    entityName: DOMAIN_CREATION_DETAILS.name,
  });

  deleteEntityViaREST({
    token,
    endPoint: EntityType.User,
    entityName: data.user.name,
  });

  deleteEntityViaREST({
    token,
    endPoint: `services/${SERVICE_CATEGORIES.DATABASE_SERVICES}`,
    entityName: serviceDetails.serviceName,
  });
};

export const databaseSchemaVersionPrerequisites = (
  token: string,
  data: EntityCreationData
) => {
  commonPrerequisites(token, data);

  // Create service
  cy.request({
    method: 'POST',
    url: `/api/v1/services/${serviceDetails.serviceCategory}`,
    headers: { Authorization: `Bearer ${token}` },
    body: serviceDetails.entityCreationDetails,
  }).then(() => {
    // Create Database
    cy.request({
      method: 'POST',
      url: `/api/v1/databases`,
      headers: { Authorization: `Bearer ${token}` },
      body: DATABASE_DETAILS_FOR_VERSION_TEST,
    }).then((response) => {
      data.database = response.body;

      // Create Database Schema
      cy.request({
        method: 'PUT',
        url: `/api/v1/databaseSchemas`,
        headers: { Authorization: `Bearer ${token}` },
        body: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST,
      }).then((response) => {
        data.schema = response.body;

        cy.request({
          method: 'PATCH',
          url: `/api/v1/databaseSchemas/${data.schema.id}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: [
            ...COMMON_PATCH_PAYLOAD,
            {
              op: 'add',
              path: '/domain',
              value: {
                id: data.domain.id,
                type: 'domain',
                name: DOMAIN_CREATION_DETAILS.name,
                description: DOMAIN_CREATION_DETAILS.description,
              },
            },
          ],
        });
      });
    });
  });
};

export const databaseVersionPrerequisites = (
  token: string,
  data: EntityCreationData
) => {
  commonPrerequisites(token, data);

  // Create service
  cy.request({
    method: 'POST',
    url: `/api/v1/services/${serviceDetails.serviceCategory}`,
    headers: { Authorization: `Bearer ${token}` },
    body: serviceDetails.entityCreationDetails,
  }).then(() => {
    // Create Database
    cy.request({
      method: 'POST',
      url: `/api/v1/databases`,
      headers: { Authorization: `Bearer ${token}` },
      body: DATABASE_DETAILS_FOR_VERSION_TEST,
    }).then((response) => {
      data.database = response.body;

      cy.request({
        method: 'PATCH',
        url: `/api/v1/databases/${data.database.id}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json-patch+json',
        },
        body: [
          ...COMMON_PATCH_PAYLOAD,
          {
            op: 'add',
            path: '/domain',
            value: {
              id: data.domain.id,
              type: 'domain',
              name: DOMAIN_CREATION_DETAILS.name,
              description: DOMAIN_CREATION_DETAILS.description,
            },
          },
        ],
      });
    });
  });
};
