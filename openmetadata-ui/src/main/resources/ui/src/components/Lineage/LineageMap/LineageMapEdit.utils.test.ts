/*
 *  Copyright 2026 Collate.
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

import type { Connection, Edge } from 'reactflow';
import {
  LineageBand,
  LineageLevelKind,
  type LineageScene,
  type LineageSceneEdge,
  type LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import {
  Source,
  type LineageDetails,
} from '../../../generated/type/entityLineage';
import {
  buildConnectPayload,
  FIELD_SEPARATOR,
  getEndpointHandle,
  getEndpointNodeId,
  getRealEntityRef,
  hasSceneEntityConnection,
  hydrateSelectedEdge,
  isEditableSceneEdge,
  isEditableSceneNode,
  isRemovableSceneNode,
  toFlowEdge,
  toFlowEdges,
  type LineageMapEdgeData,
} from './LineageMapEdit.utils';

const createNode = (
  id: string,
  entityId: string,
  overrides: Partial<LineageSceneNode> = {}
): LineageSceneNode => ({
  id,
  label: id,
  band: LineageBand.Asset,
  levelKind: LineageLevelKind.Table,
  entityType: 'table',
  fullyQualifiedName: `service.database.schema.${id}`,
  sourceEntity: {
    id: entityId,
    entityType: 'table',
    fullyQualifiedName: `service.database.schema.${id}`,
  },
  ...overrides,
});

const sourceNode = createNode('table:source', 'source-entity-id');
const targetNode = createNode('table:target', 'target-entity-id');
const nodeById = new Map([
  [sourceNode.id, sourceNode],
  [targetNode.id, targetNode],
]);

const createEdge = (
  overrides: Partial<LineageSceneEdge> = {}
): LineageSceneEdge => ({
  id: 'scene-edge',
  from: sourceNode.id,
  to: targetNode.id,
  band: LineageBand.Asset,
  weight: 1,
  ...overrides,
});

describe('LineageMap edit utils', () => {
  describe('endpoint parsing', () => {
    it('separates field handles from scene node ids', () => {
      const endpoint = `${sourceNode.id}${FIELD_SEPARATOR}source.column`;

      expect(getEndpointNodeId(endpoint)).toBe(sourceNode.id);
      expect(getEndpointHandle(endpoint)).toBe('source.column');
      expect(getEndpointHandle(sourceNode.id)).toBeUndefined();
    });

    it('matches asset and field connections returned by a refreshed scene', () => {
      const scene = {
        nodes: [sourceNode, targetNode],
        edges: [
          createEdge(),
          createEdge({
            id: 'field-edge',
            from: `${sourceNode.id}${FIELD_SEPARATOR}source.column`,
            to: `${targetNode.id}${FIELD_SEPARATOR}target.column`,
          }),
        ],
      } as LineageScene;

      expect(
        hasSceneEntityConnection(scene, 'source-entity-id', 'target-entity-id')
      ).toBe(true);
      expect(
        hasSceneEntityConnection(
          scene,
          'source-entity-id',
          'target-entity-id',
          'source.column',
          'target.column'
        )
      ).toBe(true);
      expect(
        hasSceneEntityConnection(scene, 'target-entity-id', 'source-entity-id')
      ).toBe(false);
    });
  });

  describe('edit gating', () => {
    it('uses real entity ids from sourceEntity', () => {
      expect(getRealEntityRef(sourceNode)).toEqual({
        id: 'source-entity-id',
        type: 'table',
        fullyQualifiedName: 'service.database.schema.table:source',
      });
    });

    it('allows concrete asset ghosts but excludes layers, containers, and synthetic nodes', () => {
      expect(isEditableSceneNode(sourceNode)).toBe(true);
      expect(
        isEditableSceneNode(
          createNode('layer', 'layer-id', {
            band: LineageBand.Layer,
            levelKind: LineageLevelKind.Service,
          })
        )
      ).toBe(false);
      expect(
        isEditableSceneNode(
          createNode('database', 'database-id', {
            levelKind: LineageLevelKind.Database,
          })
        )
      ).toBe(false);
      expect(
        isEditableSceneNode(
          createNode('synthetic', 'synthetic-id', {
            sourceEntity: {
              id: 'synthetic-id',
              entityType: 'table',
              lineageSceneSyntheticCount: true,
            },
          })
        )
      ).toBe(false);
    });

    it('allows only single concrete edges with matching endpoint kinds', () => {
      expect(isEditableSceneEdge(createEdge(), nodeById)).toBe(true);
      expect(
        isEditableSceneEdge(createEdge({ isRollup: true }), nodeById)
      ).toBe(false);
      expect(isEditableSceneEdge(createEdge({ weight: 2 }), nodeById)).toBe(
        false
      );
      expect(
        isEditableSceneEdge(
          createEdge({
            from: `${sourceNode.id}${FIELD_SEPARATOR}source.column`,
          }),
          nodeById
        )
      ).toBe(false);
      expect(
        isEditableSceneEdge(
          createEdge({
            from: `${sourceNode.id}${FIELD_SEPARATOR}source.column`,
            to: `${targetNode.id}${FIELD_SEPARATOR}target.column`,
          }),
          nodeById
        )
      ).toBe(true);
    });

    it('removes only non-focus nodes whose touching edges are editable', () => {
      expect(isRemovableSceneNode(targetNode, [createEdge()], nodeById)).toBe(
        true
      );
      expect(
        isRemovableSceneNode(
          { ...targetNode, isFocus: true },
          [createEdge()],
          nodeById
        )
      ).toBe(false);
      expect(
        isRemovableSceneNode(
          targetNode,
          [createEdge({ isRollup: true })],
          nodeById
        )
      ).toBe(false);
    });
  });

  describe('edge hydration', () => {
    it('keeps scene endpoints while hydrating real refs and all edge metadata', () => {
      const sceneEdge = createEdge({
        from: `${sourceNode.id}${FIELD_SEPARATOR}source.column`,
        to: `${targetNode.id}${FIELD_SEPARATOR}target.column`,
      });
      const details: LineageDetails = {
        columnsLineage: [
          {
            fromColumns: ['source.column'],
            toColumn: 'target.column',
          },
        ],
        description: 'hydrated description',
        pipeline: {
          id: 'pipeline-id',
          type: 'pipeline',
        },
        source: Source.Manual,
        sqlQuery: 'select source.column',
      };
      const flowEdge: Edge<LineageMapEdgeData> = {
        id: sceneEdge.id,
        source: sourceNode.id,
        target: targetNode.id,
        data: {
          edge: {
            fromEntity: { id: '', type: '' },
            toEntity: { id: '', type: '' },
          },
          isColumnLineage: false,
        },
      };

      const hydrated = hydrateSelectedEdge(
        flowEdge,
        sceneEdge,
        nodeById,
        details
      );

      expect(hydrated).toMatchObject({
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: 'source.column',
        targetHandle: 'target.column',
        animated: true,
        data: {
          isColumnLineage: true,
          sourceHandle: 'source.column',
          targetHandle: 'target.column',
          edge: {
            fromEntity: {
              id: 'source-entity-id',
              type: 'table',
            },
            toEntity: {
              id: 'target-entity-id',
              type: 'table',
            },
            columns: details.columnsLineage,
            description: details.description,
            pipeline: details.pipeline,
            source: Source.Manual,
            sqlQuery: details.sqlQuery,
          },
        },
      });
    });

    it('returns null when a scene endpoint has no real entity', () => {
      expect(
        hydrateSelectedEdge(
          {
            id: 'edge',
            source: 'missing',
            target: targetNode.id,
            data: {
              edge: {
                fromEntity: { id: '', type: '' },
                toEntity: { id: '', type: '' },
              },
              isColumnLineage: false,
            },
          },
          createEdge({ from: 'missing' }),
          nodeById
        )
      ).toBeNull();
    });
  });

  describe('flow edge conversion', () => {
    it('keeps scene ids for rendering and real ids for mutations', () => {
      const flowEdge = toFlowEdge(
        nodeById,
        createEdge({
          description: 'description',
          pipeline: {
            id: 'pipeline-id',
            type: 'pipeline',
          },
        })
      );

      expect(flowEdge).toMatchObject({
        id: 'scene-edge',
        source: sourceNode.id,
        target: targetNode.id,
        animated: true,
        data: {
          dataTestId:
            'edge-service.database.schema.table:source-service.database.schema.table:target',
          edge: {
            fromEntity: {
              id: 'source-entity-id',
              type: 'table',
            },
            toEntity: {
              id: 'target-entity-id',
              type: 'table',
            },
            description: 'description',
            pipeline: {
              id: 'pipeline-id',
              type: 'pipeline',
            },
          },
          isColumnLineage: false,
        },
      });
    });

    it('creates stable field handles and column test ids', () => {
      const flowEdge = toFlowEdge(
        nodeById,
        createEdge({
          from: `${sourceNode.id}${FIELD_SEPARATOR}source.column`,
          to: `${targetNode.id}${FIELD_SEPARATOR}target.column`,
        })
      );

      expect(flowEdge).toMatchObject({
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: 'source.column',
        targetHandle: 'target.column',
        data: {
          dataTestId: 'column-edge-source.column-target.column',
          isColumnLineage: true,
          sourceHandle: 'source.column',
          targetHandle: 'target.column',
        },
      });
    });

    it('renders pipeline metadata as two visual edges in node mode', () => {
      const pipelineNode = createNode('pipeline:transform', 'pipeline-id', {
        levelKind: LineageLevelKind.Pipeline,
        entityType: 'pipeline',
        fullyQualifiedName: 'pipelineService.transform',
        sourceEntity: {
          id: 'pipeline-id',
          entityType: 'pipeline',
          fullyQualifiedName: 'pipelineService.transform',
        },
      });
      const pipelineNodeById = new Map([
        ...nodeById,
        [pipelineNode.id, pipelineNode] as const,
      ]);
      const sceneEdge = createEdge({
        pipeline: {
          id: 'pipeline-id',
          type: 'pipeline',
          fullyQualifiedName: 'pipelineService.transform',
        },
      });

      const flowEdges = toFlowEdges(pipelineNodeById, [sceneEdge], true);

      expect(flowEdges).toHaveLength(2);
      expect(flowEdges).toMatchObject([
        {
          id: 'scene-edge::pipeline-in',
          source: sourceNode.id,
          target: pipelineNode.id,
          animated: false,
          data: {
            edge: {
              fromEntity: { id: 'source-entity-id' },
              toEntity: { id: 'pipeline-id' },
            },
          },
        },
        {
          id: 'scene-edge::pipeline-out',
          source: pipelineNode.id,
          target: targetNode.id,
          animated: false,
          data: {
            edge: {
              fromEntity: { id: 'pipeline-id' },
              toEntity: { id: 'target-entity-id' },
            },
          },
        },
      ]);

      flowEdges.forEach((edge) => {
        expect(edge.data?.edge.pipeline).toBeUndefined();
        expect(edge.data?.sceneEdge).toBe(sceneEdge);
      });
    });

    it('keeps the direct edge when its pipeline node is unavailable', () => {
      const sceneEdge = createEdge({
        pipeline: {
          id: 'missing-pipeline-id',
          type: 'pipeline',
        },
      });

      expect(toFlowEdges(nodeById, [sceneEdge], true)).toEqual([
        toFlowEdge(nodeById, sceneEdge),
      ]);
    });
  });

  describe('connect payloads', () => {
    const assetConnection: Connection = {
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: sourceNode.id,
      targetHandle: targetNode.id,
    };

    it('uses real ids and preserves existing asset-edge metadata', () => {
      const existingDetails: LineageDetails = {
        columnsLineage: [
          {
            fromColumns: ['existing.source'],
            toColumn: 'existing.target',
          },
        ],
        description: 'description',
        pipeline: {
          id: 'pipeline-id',
          type: 'pipeline',
        },
        source: Source.Manual,
        sqlQuery: 'select 1',
      };

      expect(
        buildConnectPayload(assetConnection, nodeById, existingDetails)
      ).toEqual({
        edge: {
          fromEntity: {
            id: 'source-entity-id',
            type: 'table',
          },
          toEntity: {
            id: 'target-entity-id',
            type: 'table',
          },
          lineageDetails: {
            columnsLineage: existingDetails.columnsLineage,
            description: existingDetails.description,
            pipeline: existingDetails.pipeline,
            source: Source.Manual,
            sqlQuery: existingDetails.sqlQuery,
          },
        },
      });
    });

    it('merges a column connection without erasing existing lineage metadata', () => {
      const existingDetails: LineageDetails = {
        columnsLineage: [
          {
            fromColumns: ['source.existing'],
            function: 'coalesce',
            toColumn: 'target.column',
          },
        ],
        description: 'description',
        pipeline: {
          id: 'pipeline-id',
          type: 'pipeline',
        },
        sqlQuery: 'select source.column',
      };

      const payload = buildConnectPayload(
        {
          source: sourceNode.id,
          target: targetNode.id,
          sourceHandle: 'source.column',
          targetHandle: 'target.column',
        },
        nodeById,
        existingDetails
      );

      expect(payload?.edge.lineageDetails).toEqual({
        columnsLineage: [
          {
            fromColumns: ['source.existing', 'source.column'],
            function: 'coalesce',
            toColumn: 'target.column',
          },
        ],
        description: existingDetails.description,
        pipeline: existingDetails.pipeline,
        source: undefined,
        sqlQuery: existingDetails.sqlQuery,
        tempLineageTables: undefined,
      });
    });

    it('rejects self-links and mixed asset/field endpoints', () => {
      expect(
        buildConnectPayload(
          {
            source: sourceNode.id,
            target: sourceNode.id,
            sourceHandle: sourceNode.id,
            targetHandle: sourceNode.id,
          },
          nodeById
        )
      ).toBeNull();
      expect(
        buildConnectPayload(
          {
            source: sourceNode.id,
            target: targetNode.id,
            sourceHandle: 'source.column',
            targetHandle: targetNode.id,
          },
          nodeById
        )
      ).toBeNull();
    });
  });
});
