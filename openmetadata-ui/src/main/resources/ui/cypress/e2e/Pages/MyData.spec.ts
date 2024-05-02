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
import {
  interceptURL,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  createSingleLevelEntity,
  generateRandomContainer,
  generateRandomDashboard,
  generateRandomMLModel,
  generateRandomPipeline,
  generateRandomTable,
  generateRandomTopic,
  hardDeleteService,
} from '../../common/EntityUtils';
import { createEntityTableViaREST } from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { generateRandomUser } from '../../common/Utils/Owner';
import {
  DATABASE_SERVICE,
  SINGLE_LEVEL_SERVICE,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const user1 = generateRandomUser();
let user1Id = '';
const user2 = generateRandomUser();
let user2Id = '';

// generate schema for 20 tables
const tables = Array(20)
  .fill(undefined)
  .map(() => generateRandomTable());

const entities = {
  table: {
    request: {
      url: '/api/v1/tables',
      body1: generateRandomTable(),
      body2: generateRandomTable(),
    },
    id1: '',
    id2: '',
  },
  topic: {
    request: {
      url: '/api/v1/topics',
      body1: generateRandomTopic(),
      body2: generateRandomTopic(),
    },
    id1: '',
    id2: '',
  },
  dashboard: {
    request: {
      url: '/api/v1/dashboards',
      body1: generateRandomDashboard(),
      body2: generateRandomDashboard(),
    },
    id1: '',
    id2: '',
  },
  pipeline: {
    request: {
      url: '/api/v1/pipelines',
      body1: generateRandomPipeline(),
      body2: generateRandomPipeline(),
    },
    id1: '',
    id2: '',
  },
  mlmodel: {
    request: {
      url: '/api/v1/mlmodels',
      body1: generateRandomMLModel(),
      body2: generateRandomMLModel(),
    },
    id1: '',
    id2: '',
  },
  container: {
    request: {
      url: '/api/v1/containers',
      body1: generateRandomContainer(),
      body2: generateRandomContainer(),
    },
    id1: '',
    id2: '',
  },
};
const team = {
  name: `cy-test-team-${uuid()}`,
  id: '',
};

const verifyEntities = ({ url }) => {
  interceptURL('GET', url, 'getEntities');
  cy.get('[data-testid="pagination"] .ant-btn-default')
    .scrollIntoView()
    .click();

  // change pagination size to 25
  cy.get('[role="menu"] [value="25"]').click();
  verifyResponseStatusCode('@getEntities', 200);

  // verify all tables are present
  tables.forEach((table) => {
    cy.get(
      `[data-testid="table-data-card_${table.databaseSchema}.${table.name}"]`
    )
      .scrollIntoView()
      .should('be.exist');
  });
};

const updateOwnerAndVerify = ({ url, body, type, entityName, newOwner }) => {
  interceptURL('GET', '/api/v1/users/loggedInUser?*', 'loggedInUser');
  interceptURL(
    'GET',
    '/api/v1/feed?type=Conversation&filterType=OWNER_OR_FOLLOWS&userId=*',
    'feedData'
  );
  cy.getAllLocalStorage().then((data) => {
    const token = getToken(data);
    cy.request({
      method: 'PATCH',
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body,
    }).then(() => {
      cy.get('[id*="tab-mentions"]').click();
      cy.get('[data-testid="no-data-placeholder-container"]').should(
        'be.visible'
      );
      cy.get('[id*="tab-all"]').click();
      verifyResponseStatusCode('@feedData', 200);
      cy.get('[data-testid="message-container"]').first().as('message');
      cy.get('@message')
        .find('[data-testid="entityType"]')
        .should('contain', type);
      cy.get('@message')
        .find('[data-testid="entitylink"]')
        .should('contain', entityName);
      cy.get('@message')
        .find('[data-testid="viewer-container"]')
        .should('contain', `Added owner: ${newOwner}`);
    });
  });
};

const prepareData = () => {
  cy.login();
  cy.getAllLocalStorage().then((data) => {
    const token = getToken(data);
    SINGLE_LEVEL_SERVICE.forEach((data) => {
      createSingleLevelEntity({
        token,
        ...data,
        entity: [],
      });
    });
    // create user
    cy.request({
      method: 'POST',
      url: `/api/v1/users/signup`,
      headers: { Authorization: `Bearer ${token}` },
      body: user1,
    }).then((response) => {
      user1Id = response.body.id;

      // create team
      cy.request({
        method: 'GET',
        url: `/api/v1/teams/name/Organization`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((teamResponse) => {
        cy.request({
          method: 'POST',
          url: `/api/v1/teams`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: team.name,
            displayName: team.name,
            teamType: 'Group',
            parents: [teamResponse.body.id],
            users: [response.body.id],
          },
        }).then((teamResponse) => {
          team.id = teamResponse.body.id;
        });
      });

      // create database service
      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        tables: [],
      });

      // generate 20 tables with newly created user as owner
      tables.forEach((table) => {
        cy.request({
          method: 'POST',
          url: `/api/v1/tables`,
          headers: { Authorization: `Bearer ${token}` },
          body: { ...table, owner: { id: response.body.id, type: 'user' } },
        }).then((tableResponse) => {
          cy.request({
            method: 'PUT',
            url: `/api/v1/tables/${tableResponse.body.id}/followers`,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(response.body.id),
          });
        });
      });
    });

    cy.request({
      method: 'POST',
      url: `/api/v1/users/signup`,
      headers: { Authorization: `Bearer ${token}` },
      body: user2,
    }).then((response) => {
      user2Id = response.body.id;
    });

    Object.entries(entities).forEach(([key, value]) => {
      cy.request({
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        url: value.request.url,
        body: value.request.body1,
      }).then((response) => {
        entities[key].id1 = response.body.id;
      });
      cy.request({
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        url: value.request.url,
        body: value.request.body2,
      }).then((response) => {
        entities[key].id2 = response.body.id;
      });
    });
  });
  cy.logout();
};

const cleanUp = () => {
  cy.login();
  cy.getAllLocalStorage().then((data) => {
    const token = getToken(data);
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
    [user1Id, user2Id].forEach((id) => {
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
    cy.request({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}?hardDelete=true&recursive=true`,
      headers: { Authorization: `Bearer ${token}` },
    });
  });
};

describe('My Data page', { tags: 'DataAssets' }, () => {
  before(prepareData);
  after(cleanUp);

  it('Verify my data widget', () => {
    // login with newly created user
    cy.login(user1.email, user1.password);
    cy.get('[data-testid="my-data-widget"]').scrollIntoView();

    // verify total count
    cy.get('[data-testid="my-data-total-count"]')
      .invoke('text')
      .should('eq', '(20)');
    cy.get(
      '[data-testid="my-data-widget"] [data-testid="view-all-link"]'
    ).click();
    verifyEntities({
      url: '/api/v1/search/query?q=*&index=all&from=0&size=25',
    });

    cy.logout();
  });

  it('Verify following widget', () => {
    // login with newly created user
    cy.login(user1.email, user1.password);
    cy.get('[data-testid="following-widget"]').scrollIntoView();

    // verify total count
    cy.get('[data-testid="following-data-total-count"]')
      .invoke('text')
      .should('eq', '(20)');
    cy.get('[data-testid="following-data"]').click();
    verifyEntities({
      url: '/api/v1/search/query?q=*followers:*&index=all&from=0&size=25',
    });
    cy.logout();
  });

  // Todo: Fix the following tests once new layout is implemented for feed https://github.com/open-metadata/OpenMetadata/issues/13871 @Ashish8689 @aniketkatkar97

  it.skip('Verify user as owner feed widget', () => {
    // login with newly created user
    cy.login(user2.email, user2.password);
    cy.get('[data-testid="no-data-placeholder-container"]')
      .scrollIntoView()
      .should(
        'contain',
        // eslint-disable-next-line max-len
        "Right now, there are no updates in the data assets you own or follow. Haven't explored yet? Dive in and claim ownership or follow the data assets that interest you to stay informed about their latest activities!"
      );

    Object.entries(entities).forEach(([key, value]) => {
      updateOwnerAndVerify({
        url: `${value.request.url}/${value.id1}`,
        body: [
          {
            op: 'add',
            path: '/owner',
            value: { id: user2Id, type: 'user' },
          },
        ],
        type: key,
        entityName: value.request.body1.name,
        newOwner: `${user2.firstName}${user2.lastName}`,
      });
    });
    cy.logout();
  });

  it.skip('Verify team as owner feed widget', () => {
    // login with newly created user
    cy.login(user1.email, user1.password);

    Object.entries(entities).forEach(([key, value]) => {
      updateOwnerAndVerify({
        url: `${value.request.url}/${value.id2}`,
        body: [
          {
            op: 'add',
            path: '/owner',
            value: { id: team.id, type: 'team' },
          },
        ],
        type: key,
        entityName: value.request.body2.name,
        newOwner: team.name,
      });
    });
    cy.logout();
  });
});
