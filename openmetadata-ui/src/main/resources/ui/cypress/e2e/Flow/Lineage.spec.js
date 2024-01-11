/*
 *  Copyright 2022 Collate.
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
import { LINEAGE_ITEMS } from '../../constants/lineage.constants';

const dataTransfer = new DataTransfer();

const dragConnection = (sourceFqn, targetFqn) => {
  cy.get(
    `[data-testid="lineage-node-${sourceFqn}"] .react-flow__handle-right`
  ).click({ force: true }); // Adding force true for handles because it can be hidden behind the node

  return cy
    .get(`[data-testid="lineage-node-${targetFqn}"] .react-flow__handle-left`)
    .click({ force: true }); // Adding force true for handles because it can be hidden behind the node
};

const connectEdgeBetweenNodes = (fromNode, toNode) => {
  interceptURL('PUT', '/api/v1/lineage', 'lineageApi');
  const type = toNode.searchIndex;

  cy.get(`[data-testid="${type}-draggable-icon"]`)
    .invoke('attr', 'draggable')
    .should('contain', 'true');

  cy.get(`[data-testid="${type}-draggable-icon"]`).trigger('dragstart', {
    dataTransfer,
  });

  cy.get('[data-testid="lineage-details"]')
    .trigger('drop', { dataTransfer })
    .trigger('dragend');

  cy.get(`[data-testid="${type}-draggable-icon"]`)
    .invoke('attr', 'draggable')
    .should('contain', 'false');

  cy.get('[data-testid="suggestion-node"]').click();
  cy.get('[data-testid="suggestion-node"] input').click().type(toNode.term);
  cy.get('.ant-select-dropdown .ant-select-item').eq(0).click();

  dragConnection(fromNode.fqn, toNode.fqn);
  verifyResponseStatusCode('@lineageApi', 200);
};

const verifyNodePresent = (node) => {
  cy.get('.react-flow__controls-fitview').click();
  cy.get(`[data-testid="lineage-node-${node.fqn}"]`).should('be.visible');
  cy.get(
    `[data-testid="lineage-node-${node.fqn}"] [data-testid="entity-header-name"]`
  ).should('have.text', node.term);
};

const deleteNode = (node) => {
  cy.get('.react-flow__controls-fitview').click();
  interceptURL('DELETE', '/api/v1/lineage/**', 'lineageDeleteApi');
  cy.get(`[data-testid="lineage-node-${node.fqn}"]`).click({ force: true });
  // Adding force true for handles because it can be hidden behind the node
  cy.get('[data-testid="lineage-node-remove-btn"]').click({ force: true });
  verifyResponseStatusCode('@lineageDeleteApi', 200);
};

describe('Entity Details Page', () => {
  beforeEach(() => {
    cy.login();
  });

  LINEAGE_ITEMS.forEach((entity, index) => {
    it(`Lineage Add Node for entity ${entity.entityType}`, () => {
      visitEntityDetailsPage({
        term: entity.term,
        serviceName: entity.serviceName,
        entity: entity.entity,
      });

      cy.get('[data-testid="lineage"]').click();
      cy.get('[data-testid="edit-lineage"]').click();

      // Connect the current entity to all others in the array except itself
      for (let i = 0; i < LINEAGE_ITEMS.length; i++) {
        if (i !== index) {
          connectEdgeBetweenNodes(entity, LINEAGE_ITEMS[i]);
        }
      }

      cy.get('[data-testid="edit-lineage"]').click();
      cy.reload();

      // Verify Added Nodes
      for (let i = 0; i < LINEAGE_ITEMS.length; i++) {
        if (i !== index) {
          verifyNodePresent(LINEAGE_ITEMS[i]);
        }
      }

      cy.get('[data-testid="edit-lineage"]').click();
    });

    it(`Lineage Remove Node between ${entity.entityType}`, () => {
      visitEntityDetailsPage({
        term: entity.term,
        serviceName: entity.serviceName,
        entity: entity.entity,
      });

      cy.get('[data-testid="lineage"]').click();
      cy.get('[data-testid="edit-lineage"]').click();

      // Delete Nodes
      for (let i = 0; i < LINEAGE_ITEMS.length; i++) {
        if (i !== index) {
          deleteNode(LINEAGE_ITEMS[i]);
          cy.get(`[data-testid="lineage-node-${LINEAGE_ITEMS[i].fqn}"]`).should(
            'not.exist'
          );
        }
      }

      cy.get('[data-testid="edit-lineage"]').click();
    });
  });
});
