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

import { isUndefined } from 'lodash';
import {
  interceptURL,
  verifyResponseStatusCode,
  visitDataModelPage,
  visitEntityDetailsPage,
} from './common';

export const visitEntityDetailsVersionPage = (
  entityDetails,
  id,
  entityFQN,
  version
) => {
  visitEntityDetailsPage({
    term: entityDetails.name,
    serviceName: entityDetails.serviceName,
    entity: entityDetails.entity,
    entityType: entityDetails.entityType,
  });

  interceptURL(
    'GET',
    `/api/v1/${entityDetails.entity}/name/${entityFQN}?*include=all`,
    'getTableDetails'
  );
  interceptURL(
    'GET',
    `/api/v1/${entityDetails.entity}/${id}/versions`,
    'getVersionsList'
  );
  interceptURL(
    'GET',
    `/api/v1/${entityDetails.entity}/${id}/versions/${version ?? '*'}`,
    'getSelectedVersionDetails'
  );

  cy.get('[data-testid="version-button"]').as('versionButton');

  if (!isUndefined(version)) {
    cy.get('@versionButton').contains(version);
  }

  cy.get('@versionButton').click();

  verifyResponseStatusCode('@getTableDetails', 200);
  verifyResponseStatusCode('@getVersionsList', 200);
  verifyResponseStatusCode('@getSelectedVersionDetails', 200);
};

export const visitDataModelVersionPage = (
  dataModelFQN,
  dataModelId,
  dataModelName,
  version
) => {
  visitDataModelPage(dataModelFQN, dataModelName);

  interceptURL(
    'GET',
    `/api/v1/dashboard/datamodels/${dataModelId}/versions`,
    'getVersionsList'
  );
  interceptURL(
    'GET',
    `/api/v1/dashboard/datamodels/${dataModelId}/versions/${version ?? '*'}`,
    'getSelectedVersionDetails'
  );

  cy.get('[data-testid="version-button"]').as('versionButton');

  if (!isUndefined(version)) {
    cy.get('@versionButton').contains(version);
  }

  cy.get('@versionButton').click();

  verifyResponseStatusCode('@getDataModelDetails', 200);
  verifyResponseStatusCode('@getVersionsList', 200);
  verifyResponseStatusCode('@getSelectedVersionDetails', 200);
};
