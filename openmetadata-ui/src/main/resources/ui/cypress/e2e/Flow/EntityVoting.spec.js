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
  createEntityTable,
  createSingleLevelEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import {
  DASHBOARD_DATA_MODEL_DETAILS,
  DATABASE_SERVICE,
  SINGLE_LEVEL_SERVICE,
  STORED_PROCEDURE_DETAILS,
  VISIT_ENTITIES_DATA,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const VOTING_ENTITIES = [
  VISIT_ENTITIES_DATA.table,
  VISIT_ENTITIES_DATA.topic,
  VISIT_ENTITIES_DATA.dashboard,
  VISIT_ENTITIES_DATA.pipeline,
  VISIT_ENTITIES_DATA.mlmodel,
  VISIT_ENTITIES_DATA.storedProcedure,
  VISIT_ENTITIES_DATA.dataModel,
];

describe('Check if voting work properly in entities', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.tables],
      });
      SINGLE_LEVEL_SERVICE.forEach((data) => {
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
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
      SINGLE_LEVEL_SERVICE.forEach((data) => {
        hardDeleteService({
          token,
          serviceFqn: data.service.name,
          serviceType: data.serviceType,
        });
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  VOTING_ENTITIES.map((entityDetails) => {
    const apiEntity =
      entityDetails.entity === 'dashboardDataModel'
        ? 'dashboard/datamodels'
        : entityDetails.entity;

    it(`UpVote the ${entityDetails.entity} entity`, () => {
      interceptURL(
        'GET',
        `/api/v1/${apiEntity}/name/*?fields=*`,
        'getEntityDetail'
      );
      interceptURL('PUT', `/api/v1/${apiEntity}/*/vote`, 'upVoting');

      visitEntityDetailsPage({
        term: entityDetails.term,
        serviceName: entityDetails.serviceName,
        entity: entityDetails.entity,
      });
      verifyResponseStatusCode('@getEntityDetail', 200);

      cy.get('[data-testid="up-vote-btn"]').click();

      cy.wait('@upVoting').then(({ request, response }) => {
        expect(request.body.updatedVoteType).to.equal('votedUp');

        expect(response.statusCode).to.equal(200);
      });

      cy.get('[data-testid="up-vote-count"]').contains(1);
    });
  });

  VOTING_ENTITIES.map((entityDetails) => {
    const apiEntity =
      entityDetails.entity === 'dashboardDataModel'
        ? 'dashboard/datamodels'
        : entityDetails.entity;

    it(`DownVote the ${entityDetails.entity} entity`, () => {
      interceptURL(
        'GET',
        `/api/v1/${apiEntity}/name/*?fields=*`,
        'getEntityDetail'
      );
      interceptURL('PUT', `/api/v1/${apiEntity}/*/vote`, 'downVoting');

      visitEntityDetailsPage({
        term: entityDetails.term,
        serviceName: entityDetails.serviceName,
        entity: entityDetails.entity,
      });
      verifyResponseStatusCode('@getEntityDetail', 200);

      cy.get('[data-testid="up-vote-count"]').contains(1);

      cy.get('[data-testid="down-vote-btn"]').click();

      cy.wait('@downVoting').then(({ request, response }) => {
        expect(request.body.updatedVoteType).to.equal('votedDown');

        expect(response.statusCode).to.equal(200);
      });

      cy.get('[data-testid="up-vote-count"]').contains(0);
      cy.get('[data-testid="down-vote-count"]').contains(1);
    });
  });

  VOTING_ENTITIES.map((entityDetails) => {
    const apiEntity =
      entityDetails.entity === 'dashboardDataModel'
        ? 'dashboard/datamodels'
        : entityDetails.entity;

    it(`UnVote the ${entityDetails.entity} entity`, () => {
      interceptURL(
        'GET',
        `/api/v1/${apiEntity}/name/*?fields=*`,
        'getEntityDetail'
      );
      interceptURL('PUT', `/api/v1/${apiEntity}/*/vote`, 'unVoting');

      visitEntityDetailsPage({
        term: entityDetails.term,
        serviceName: entityDetails.serviceName,
        entity: entityDetails.entity,
      });
      verifyResponseStatusCode('@getEntityDetail', 200);

      cy.get('[data-testid="down-vote-count"]').contains(1);

      cy.get('[data-testid="down-vote-btn"]').click();

      cy.wait('@unVoting').then(({ request, response }) => {
        expect(request.body.updatedVoteType).to.equal('unVoted');

        expect(response.statusCode).to.equal(200);
      });

      cy.get('[data-testid="down-vote-count"]').contains(0);
    });
  });
});
