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

import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';
import {
  LINEAGE_ITEMS,
  PIPELINE_ITEMS,
} from '../../constants/lineage.constants';

const dataTransfer = new DataTransfer();

const dragConnection = (sourceId, targetId, isColumnLineage = false) => {
  const selector = !isColumnLineage
    ? '.lineage-node-handle'
    : '.lineage-column-node-handle';

  cy.get(
    `[data-testid="${sourceId}"] ${selector}.react-flow__handle-right`
  ).click({
    force: true,
  }); // Adding force true for handles because it can be hidden behind the node

  return cy
    .get(`[data-testid="${targetId}"] ${selector}.react-flow__handle-left`)
    .click({ force: true }); // Adding force true for handles because it can be hidden behind the node
};

const performZoomOut = () => {
  for (let i = 0; i < 12; i++) {
    cy.get('.react-flow__controls-zoomout').click({ force: true });
  }
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

  interceptURL(
    'GET',
    `/api/v1/search/query?q=*${toNode.term}*&**`,
    'nodeQuery'
  );
  cy.get('[data-testid="suggestion-node"] input').click().type(toNode.term);
  verifyResponseStatusCode('@nodeQuery', 200);

  cy.get(`[data-testid="node-suggestion-${toNode.fqn}"]`)
    .scrollIntoView()
    .click();

  dragConnection(`lineage-node-${fromNode.fqn}`, `lineage-node-${toNode.fqn}`);
  verifyResponseStatusCode('@lineageApi', 200);
};

const verifyNodePresent = (node) => {
  cy.get(`[data-testid="lineage-node-${node.fqn}"]`).should('be.visible');
  cy.get(
    `[data-testid="lineage-node-${node.fqn}"] [data-testid="entity-header-name"]`
  ).should('have.text', node.term);
};

const deleteNode = (node) => {
  interceptURL('DELETE', '/api/v1/lineage/**', 'lineageDeleteApi');
  cy.get(`[data-testid="lineage-node-${node.fqn}"]`).click({ force: true });
  // Adding force true for handles because it can be hidden behind the node
  cy.get('[data-testid="lineage-node-remove-btn"]').click({ force: true });
  verifyResponseStatusCode('@lineageDeleteApi', 200);
};

const deleteEdge = (fromNode, toNode) => {
  interceptURL('DELETE', '/api/v1/lineage/**', 'lineageDeleteApi');
  cy.get(`[data-testid="edge-${fromNode.fqn}-${toNode.fqn}"]`).click({
    force: true,
  });

  if (
    ['Table', 'Topic'].indexOf(fromNode.entityType) > -1 &&
    ['Table', 'Topic'].indexOf(toNode.entityType) > -1
  ) {
    // Adding force true for handles because it can be hidden behind the node
    cy.get('[data-testid="add-pipeline"]').click({ force: true });
    cy.get(
      '[data-testid="add-edge-modal"] [data-testid="remove-edge-button"]'
    ).click();
  } else {
    cy.get('[data-testid="delete-button"]').click({ force: true });
  }
  cy.get(
    '[data-testid="delete-edge-confirmation-modal"] .ant-btn-primary'
  ).click();
  verifyResponseStatusCode('@lineageDeleteApi', 200);
};

const applyPipelineFromModal = (fromNode, toNode, pipelineData) => {
  interceptURL('PUT', '/api/v1/lineage', 'lineageApi');
  cy.get(`[data-testid="edge-${fromNode.fqn}-${toNode.fqn}"]`).click({
    force: true,
  });
  cy.get('[data-testid="add-pipeline"]').click({ force: true });

  cy.get('[data-testid="add-edge-modal"] [data-testid="field-input"]')
    .click()
    .type(pipelineData.term);

  cy.get(`[data-testid="pipeline-entry-${pipelineData.fqn}"]`).click();
  cy.get('[data-testid="save-button"]').click();

  verifyResponseStatusCode('@lineageApi', 200);
};

const editPipelineEdgeDescription = (
  fromNode,
  toNode,
  pipelineData,
  description
) => {
  cy.get(
    `[data-testid="pipeline-label-${fromNode.fqn}-${toNode.fqn}"]`
  ).click();
  cy.get('.edge-info-drawer').should('be.visible');
  cy.get('.edge-info-drawer [data-testid="Edge"] a').contains(
    pipelineData.name
  );

  interceptURL('PUT', `/api/v1/lineage`, 'updateLineage');
  cy.get('.edge-info-drawer [data-testid="edit-description"]').click();

  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .click()
    .clear()
    .type(description);

  cy.get('[data-testid="save"]').click();
  verifyResponseStatusCode('@updateLineage', 200);
  cy.get(
    '.edge-info-drawer [data-testid="asset-description-container"] [data-testid="viewer-container"]'
  ).should('contain', description);
};

const verifyPipelineDataInDrawer = (
  fromNode,
  toNode,
  pipelineData,
  bVerifyPipelineLineage
) => {
  cy.get(
    `[data-testid="pipeline-label-${fromNode.fqn}-${toNode.fqn}"]`
  ).click();
  cy.get('.edge-info-drawer').should('be.visible');
  cy.get('.edge-info-drawer [data-testid="Edge"] a').contains(
    pipelineData.name
  );

  if (bVerifyPipelineLineage) {
    cy.get('.edge-info-drawer [data-testid="Edge"] a').click();
    cy.get('[data-testid="lineage"]').click();
    cy.get('.custom-edge-pipeline-button').should(
      'have.class',
      'blinking-border'
    );
    visitEntityDetailsPage({
      term: fromNode.term,
      serviceName: fromNode.serviceName,
      entity: fromNode.entity,
      entityFqn: fromNode.fqn,
    });
    cy.get('[data-testid="lineage"]').click();
  } else {
    cy.get('.edge-info-drawer .ant-drawer-header .anticon-close').click();
  }
};

const addPipelineBetweenNodes = (
  sourceEntity,
  targetEntity,
  pipelineItem?,
  bVerifyPipeline?: boolean
) => {
  visitEntityDetailsPage({
    term: sourceEntity.term,
    serviceName: sourceEntity.serviceName,
    entity: sourceEntity.entity,
    entityFqn: sourceEntity.fqn,
  });

  cy.get('[data-testid="lineage"]').click();
  cy.get('[data-testid="edit-lineage"]').click();

  performZoomOut();

  connectEdgeBetweenNodes(sourceEntity, targetEntity);
  if (pipelineItem) {
    applyPipelineFromModal(sourceEntity, targetEntity, pipelineItem);
    cy.get('[data-testid="edit-lineage"]').click();
    verifyPipelineDataInDrawer(
      sourceEntity,
      targetEntity,
      pipelineItem,
      bVerifyPipeline
    );
  }
};

const activateColumnLayer = () => {
  cy.get('[data-testid="lineage-layer-btn"]').click();
  cy.get('[data-testid="lineage-layer-column-btn"]').click();
};

const verifyColumnLayerInactive = () => {
  cy.get('[data-testid="lineage-layer-btn"]').click(); // Open Layer popover
  cy.get('[data-testid="lineage-layer-column-btn"]').should(
    'not.have.class',
    'active'
  );
  cy.get('[data-testid="lineage-layer-btn"]').click(); // Close Layer popover
};

const addColumnLineage = (fromNode, toNode, exitEditMode = true) => {
  interceptURL('PUT', '/api/v1/lineage', 'lineageApi');
  dragConnection(
    `column-${fromNode.columns[0]}`,
    `column-${toNode.columns[0]}`,
    true
  );
  verifyResponseStatusCode('@lineageApi', 200);
  if (exitEditMode) {
    cy.get('[data-testid="edit-lineage"]').click();
  }
  cy.get(
    `[data-testid="column-edge-${btoa(fromNode.columns[0])}-${btoa(
      toNode.columns[0]
    )}"]`
  );
};

const removeColumnLineage = (fromNode, toNode) => {
  interceptURL('PUT', '/api/v1/lineage', 'lineageApi');
  cy.get(
    `[data-testid="column-edge-${btoa(fromNode.columns[0])}-${btoa(
      toNode.columns[0]
    )}"]`
  ).click({ force: true });
  cy.get('[data-testid="delete-button"]').click({ force: true });
  cy.get(
    '[data-testid="delete-edge-confirmation-modal"] .ant-btn-primary'
  ).click();

  verifyResponseStatusCode('@lineageApi', 200);

  cy.get('[data-testid="edit-lineage"]').click();

  cy.get(
    `[data-testid="column-edge-${btoa(fromNode.columns[0])}-${btoa(
      toNode.columns[0]
    )}"]`
  ).should('not.exist');
};

describe('Lineage verification', { tags: 'DataAssets' }, () => {
  beforeEach(() => {
    cy.login();
  });

  LINEAGE_ITEMS.forEach((entity, index) => {
    it(`Lineage Add Node for entity ${entity.entityType}`, () => {
      interceptURL('GET', '/api/v1/lineage', 'lineageApi');
      visitEntityDetailsPage({
        term: entity.term,
        serviceName: entity.serviceName,
        entity: entity.entity as EntityType,
        entityFqn: entity.fqn,
      });

      cy.get('[data-testid="lineage"]').click();
      verifyColumnLayerInactive();
      cy.get('[data-testid="edit-lineage"]').click();

      performZoomOut();

      // Connect the current entity to all others in the array except itself
      for (let i = 0; i < LINEAGE_ITEMS.length; i++) {
        if (i !== index) {
          connectEdgeBetweenNodes(entity, LINEAGE_ITEMS[i]);
        }
      }

      cy.get('[data-testid="edit-lineage"]').click();
      cy.reload();

      verifyResponseStatusCode('@lineageApi', 200);

      performZoomOut();

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
        entity: entity.entity as EntityType,
        entityFqn: entity.fqn,
      });

      cy.get('[data-testid="lineage"]').click();
      cy.get('[data-testid="edit-lineage"]').click();

      performZoomOut();

      // Delete Nodes
      for (let i = 0; i < LINEAGE_ITEMS.length; i++) {
        if (i !== index) {
          deleteEdge(entity, LINEAGE_ITEMS[i]);
          cy.get(
            `[data-testid="edge-${entity.fqn}-${LINEAGE_ITEMS[i].fqn}"]`
          ).should('not.exist');
        }
      }

      cy.get('[data-testid="edit-lineage"]').click();
    });
  });

  it('Lineage Add Pipeline Between Tables', () => {
    const sourceEntity = LINEAGE_ITEMS[0];
    const targetEntity = LINEAGE_ITEMS[1];
    addPipelineBetweenNodes(
      sourceEntity,
      targetEntity,
      PIPELINE_ITEMS[0],
      true
    );
    cy.get('[data-testid="edit-lineage"]').click();
    deleteNode(targetEntity);
  });

  it('Lineage Add Pipeline Between Table and Topic', () => {
    const sourceEntity = LINEAGE_ITEMS[1];
    const targetEntity = LINEAGE_ITEMS[2];
    addPipelineBetweenNodes(
      sourceEntity,
      targetEntity,
      PIPELINE_ITEMS[0],
      true
    );

    editPipelineEdgeDescription(
      sourceEntity,
      targetEntity,
      PIPELINE_ITEMS[0],
      'Test Description'
    );

    cy.get('[data-testid="edit-lineage"]').click();
    deleteNode(targetEntity);
  });

  it('Add column lineage', () => {
    const sourceEntity = LINEAGE_ITEMS[0];
    for (let i = 1; i < LINEAGE_ITEMS.length; i++) {
      const targetEntity = LINEAGE_ITEMS[i];
      if (targetEntity.columns.length > 0) {
        addPipelineBetweenNodes(sourceEntity, targetEntity);
        activateColumnLayer();
        // Add column lineage
        addColumnLineage(sourceEntity, targetEntity);

        cy.get('[data-testid="edit-lineage"]').click();
        removeColumnLineage(sourceEntity, targetEntity);

        cy.get('[data-testid="edit-lineage"]').click();
        deleteNode(targetEntity);
        cy.goToHomePage();
      }
    }
  });
});
