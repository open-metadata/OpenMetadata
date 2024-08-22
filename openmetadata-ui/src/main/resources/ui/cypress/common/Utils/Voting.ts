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
import { interceptURL } from '../common';

export const upVoteEntity = ({ endPoint }: { endPoint: EntityType }) => {
  interceptURL('GET', `/api/v1/${endPoint}/name/*?fields=*`, 'getEntityDetail');
  interceptURL('PUT', `/api/v1/${endPoint}/*/vote`, 'upVoting');

  cy.get('[data-testid="up-vote-btn"]').click();

  cy.wait('@upVoting').then(({ request, response }) => {
    if (response) {
      expect(request.body.updatedVoteType).to.equal('votedUp');

      expect(response.statusCode).to.equal(200);
    }
  });

  cy.get('[data-testid="up-vote-count"]').contains(1);
};

export const downVoteEntity = ({ endPoint }: { endPoint: EntityType }) => {
  interceptURL('GET', `/api/v1/${endPoint}/name/*?fields=*`, 'getEntityDetail');
  interceptURL('PUT', `/api/v1/${endPoint}/*/vote`, 'downVoting');

  cy.get('[data-testid="up-vote-count"]').contains(1);

  cy.get('[data-testid="down-vote-btn"]').click();

  cy.wait('@downVoting').then(({ request, response }) => {
    if (response) {
      expect(request.body.updatedVoteType).to.equal('votedDown');

      expect(response.statusCode).to.equal(200);
    }
  });

  cy.get('[data-testid="up-vote-count"]').contains(0);
  cy.get('[data-testid="down-vote-count"]').contains(1);
};
