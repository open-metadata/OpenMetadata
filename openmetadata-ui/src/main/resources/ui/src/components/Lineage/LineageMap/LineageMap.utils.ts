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

import type { TFunction } from 'i18next';
import {
  LineageBand,
  LineageLens,
  LineageLevelKind,
  LineageScene,
  LineageSceneBreadcrumb,
  LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';

const ASSET_LEVEL_KINDS = new Set<LineageLevelKind>([
  LineageLevelKind.Table,
  LineageLevelKind.Topic,
  LineageLevelKind.Dashboard,
  LineageLevelKind.Model,
  LineageLevelKind.Pipeline,
  LineageLevelKind.Container,
  LineageLevelKind.SearchIndex,
  LineageLevelKind.ApiEndpoint,
  LineageLevelKind.Metric,
  LineageLevelKind.Directory,
  LineageLevelKind.File,
  LineageLevelKind.Spreadsheet,
  LineageLevelKind.Worksheet,
  LineageLevelKind.Asset,
]);

const LENS_CONTAINER_LEVEL_KINDS = new Set<LineageLevelKind>([
  LineageLevelKind.Service,
  LineageLevelKind.Domain,
  LineageLevelKind.DataProduct,
]);

const COUNT_SUBTITLE_LEVEL_KINDS = new Set<LineageLevelKind>([
  LineageLevelKind.Service,
  LineageLevelKind.Database,
  LineageLevelKind.Schema,
  LineageLevelKind.Domain,
  LineageLevelKind.DataProduct,
]);

const COUNT_KIND_PRIORITY = [
  LineageLevelKind.Table,
  LineageLevelKind.Topic,
  LineageLevelKind.Dashboard,
  LineageLevelKind.Model,
  LineageLevelKind.Pipeline,
  LineageLevelKind.Container,
  LineageLevelKind.SearchIndex,
  LineageLevelKind.ApiEndpoint,
  LineageLevelKind.Metric,
  LineageLevelKind.Directory,
  LineageLevelKind.File,
  LineageLevelKind.Spreadsheet,
  LineageLevelKind.Worksheet,
  LineageLevelKind.Asset,
];

const LEVEL_ENTITY_LABEL_KEYS: Record<
  LineageLevelKind,
  { singular: string; plural: string }
> = {
  [LineageLevelKind.Service]: {
    singular: 'label.service',
    plural: 'label.service-plural',
  },
  [LineageLevelKind.Database]: {
    singular: 'label.database',
    plural: 'label.database-plural',
  },
  [LineageLevelKind.Schema]: {
    singular: 'label.schema',
    plural: 'label.schema-plural',
  },
  [LineageLevelKind.Table]: {
    singular: 'label.table',
    plural: 'label.table-plural',
  },
  [LineageLevelKind.Column]: {
    singular: 'label.column',
    plural: 'label.column-plural',
  },
  [LineageLevelKind.Topic]: {
    singular: 'label.topic',
    plural: 'label.topic-plural',
  },
  [LineageLevelKind.Field]: {
    singular: 'label.field',
    plural: 'label.field-plural',
  },
  [LineageLevelKind.Dashboard]: {
    singular: 'label.dashboard',
    plural: 'label.dashboard-plural',
  },
  [LineageLevelKind.Chart]: {
    singular: 'label.chart',
    plural: 'label.chart-plural',
  },
  [LineageLevelKind.Model]: {
    singular: 'label.model',
    plural: 'label.model-plural',
  },
  [LineageLevelKind.Feature]: {
    singular: 'label.feature',
    plural: 'label.feature-plural',
  },
  [LineageLevelKind.Pipeline]: {
    singular: 'label.pipeline',
    plural: 'label.pipeline-plural',
  },
  [LineageLevelKind.Task]: {
    singular: 'label.task',
    plural: 'label.task-plural',
  },
  [LineageLevelKind.Domain]: {
    singular: 'label.domain',
    plural: 'label.domain-plural',
  },
  [LineageLevelKind.DataProduct]: {
    singular: 'label.data-product',
    plural: 'label.data-product-plural',
  },
  [LineageLevelKind.Container]: {
    singular: 'label.container',
    plural: 'label.container-plural',
  },
  [LineageLevelKind.SearchIndex]: {
    singular: 'label.search-index',
    plural: 'label.search-index-plural',
  },
  [LineageLevelKind.ApiEndpoint]: {
    singular: 'label.api-endpoint',
    plural: 'label.api-endpoint-plural',
  },
  [LineageLevelKind.Metric]: {
    singular: 'label.metric',
    plural: 'label.metric-plural',
  },
  [LineageLevelKind.Directory]: {
    singular: 'label.directory',
    plural: 'label.directory-plural',
  },
  [LineageLevelKind.File]: {
    singular: 'label.file',
    plural: 'label.file-plural',
  },
  [LineageLevelKind.Spreadsheet]: {
    singular: 'label.spreadsheet',
    plural: 'label.spreadsheet-plural',
  },
  [LineageLevelKind.Worksheet]: {
    singular: 'label.worksheet',
    plural: 'label.worksheet-plural',
  },
  [LineageLevelKind.Asset]: {
    singular: 'label.asset',
    plural: 'label.asset-plural',
  },
};

export const getBandLabelKey = (band: LineageBand) => {
  switch (band) {
    case LineageBand.Layer:
      return 'label.lineage-map-layer-view';
    case LineageBand.Field:
      return 'label.field-level-lineage';
    default:
      return 'label.data-asset-plural';
  }
};

export interface LineageSceneRequest {
  lens: LineageLens;
  band: LineageBand;
  focusFqn?: string;
  entityType?: string;
}

export interface LineagePathEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface LineagePathHighlight {
  edgeIds: Set<string>;
  nodeIds: Set<string>;
  fieldIds?: Set<string>;
}

interface LineageFieldPathConnection {
  edgeId: string;
  fieldId: string;
  nodeId: string;
}

export interface LineagePathHighlightIndex {
  edgeIdsByNodeId: Map<string, Set<string>>;
  adjacentNodeIdsByNodeId: Map<string, Set<string>>;
  incomingFieldConnectionsByFieldId: Map<string, LineageFieldPathConnection[]>;
  outgoingFieldConnectionsByFieldId: Map<string, LineageFieldPathConnection[]>;
  nodeIdsByFieldId: Map<string, Set<string>>;
}

export const getLensRootLabelKey = (lens: LineageLens) => {
  switch (lens) {
    case LineageLens.Domain:
      return 'label.all-domain-plural';
    case LineageLens.DataProduct:
      return 'label.all-data-product-plural';
    default:
      return 'label.all-service-plural';
  }
};

export const buildLineagePathHighlightIndex = (
  edges: LineagePathEdge[]
): LineagePathHighlightIndex => {
  const edgeIdsByNodeId = new Map<string, Set<string>>();
  const adjacentNodeIdsByNodeId = new Map<string, Set<string>>();
  const incomingFieldConnectionsByFieldId = new Map<
    string,
    LineageFieldPathConnection[]
  >();
  const outgoingFieldConnectionsByFieldId = new Map<
    string,
    LineageFieldPathConnection[]
  >();
  const nodeIdsByFieldId = new Map<string, Set<string>>();

  edges.forEach((edge) => {
    [
      [edge.source, edge.target],
      [edge.target, edge.source],
    ].forEach(([nodeId, adjacentNodeId]) => {
      const edgeIds = edgeIdsByNodeId.get(nodeId) ?? new Set<string>();
      const adjacentNodeIds =
        adjacentNodeIdsByNodeId.get(nodeId) ?? new Set<string>();

      edgeIds.add(edge.id);
      adjacentNodeIds.add(adjacentNodeId);
      edgeIdsByNodeId.set(nodeId, edgeIds);
      adjacentNodeIdsByNodeId.set(nodeId, adjacentNodeIds);
    });

    if (edge.sourceHandle && edge.targetHandle) {
      const sourceNodeIds =
        nodeIdsByFieldId.get(edge.sourceHandle) ?? new Set<string>();
      const targetNodeIds =
        nodeIdsByFieldId.get(edge.targetHandle) ?? new Set<string>();
      const sourceConnections =
        outgoingFieldConnectionsByFieldId.get(edge.sourceHandle) ?? [];
      const targetConnections =
        incomingFieldConnectionsByFieldId.get(edge.targetHandle) ?? [];

      sourceNodeIds.add(edge.source);
      targetNodeIds.add(edge.target);
      sourceConnections.push({
        edgeId: edge.id,
        fieldId: edge.targetHandle,
        nodeId: edge.target,
      });
      targetConnections.push({
        edgeId: edge.id,
        fieldId: edge.sourceHandle,
        nodeId: edge.source,
      });
      nodeIdsByFieldId.set(edge.sourceHandle, sourceNodeIds);
      nodeIdsByFieldId.set(edge.targetHandle, targetNodeIds);
      outgoingFieldConnectionsByFieldId.set(
        edge.sourceHandle,
        sourceConnections
      );
      incomingFieldConnectionsByFieldId.set(
        edge.targetHandle,
        targetConnections
      );
    }
  });

  return {
    edgeIdsByNodeId,
    adjacentNodeIdsByNodeId,
    incomingFieldConnectionsByFieldId,
    outgoingFieldConnectionsByFieldId,
    nodeIdsByFieldId,
  };
};

export const getConnectedLineagePathHighlight = (
  nodeId: string | undefined,
  index: LineagePathHighlightIndex
): LineagePathHighlight | undefined => {
  if (!nodeId) {
    return undefined;
  }

  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>([nodeId]);
  const queue = [nodeId];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const currentNodeId = queue[queueIndex];
    queueIndex += 1;

    index.edgeIdsByNodeId
      .get(currentNodeId)
      ?.forEach((edgeId) => edgeIds.add(edgeId));
    index.adjacentNodeIdsByNodeId
      .get(currentNodeId)
      ?.forEach((adjacentNodeId) => {
        if (!nodeIds.has(adjacentNodeId)) {
          nodeIds.add(adjacentNodeId);
          queue.push(adjacentNodeId);
        }
      });
  }

  return {
    edgeIds,
    nodeIds,
  };
};

export const getConnectedFieldLineagePathHighlight = (
  fieldId: string | undefined,
  index: LineagePathHighlightIndex
): LineagePathHighlight | undefined => {
  if (!fieldId) {
    return undefined;
  }

  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>(index.nodeIdsByFieldId.get(fieldId) ?? []);
  const fieldIds = new Set<string>([fieldId]);

  const traceFields = (
    connectionsByFieldId: Map<string, LineageFieldPathConnection[]>
  ) => {
    const visitedFieldIds = new Set<string>([fieldId]);
    const queue = [fieldId];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const currentFieldId = queue[queueIndex];
      queueIndex += 1;

      connectionsByFieldId
        .get(currentFieldId)
        ?.forEach(({ edgeId, fieldId: connectedFieldId, nodeId }) => {
          edgeIds.add(edgeId);
          fieldIds.add(connectedFieldId);
          nodeIds.add(nodeId);
          index.nodeIdsByFieldId
            .get(connectedFieldId)
            ?.forEach((connectedNodeId) => nodeIds.add(connectedNodeId));

          if (!visitedFieldIds.has(connectedFieldId)) {
            visitedFieldIds.add(connectedFieldId);
            queue.push(connectedFieldId);
          }
        });
    }
  };

  traceFields(index.incomingFieldConnectionsByFieldId);
  traceFields(index.outgoingFieldConnectionsByFieldId);

  return {
    edgeIds,
    nodeIds,
    fieldIds,
  };
};

const getLowercaseLabel = (
  t: TFunction,
  levelKind: LineageLevelKind,
  count = 1
) => {
  const labelKeys = LEVEL_ENTITY_LABEL_KEYS[levelKind];

  return t(
    count === 1 ? labelKeys.singular : labelKeys.plural
  ).toLocaleLowerCase();
};

export const getSceneNodeCountSubtitle = (
  node: LineageSceneNode,
  t: TFunction
) => {
  if (!COUNT_SUBTITLE_LEVEL_KINDS.has(node.levelKind)) {
    return undefined;
  }

  const countEntries = COUNT_KIND_PRIORITY.map((levelKind) => ({
    levelKind,
    count: node.counts?.[levelKind] ?? 0,
  })).filter(({ count }) => count > 0);

  if (countEntries.length === 0) {
    return undefined;
  }

  const totalCount = countEntries.reduce((sum, entry) => sum + entry.count, 0);
  const countedLevelKind =
    countEntries.length === 1
      ? countEntries[0].levelKind
      : LineageLevelKind.Asset;

  return t('label.lineage-map-node-count-subtitle', {
    kind: getLowercaseLabel(t, node.levelKind),
    count: totalCount,
    entity: getLowercaseLabel(t, countedLevelKind, totalCount),
  });
};

const getLevelLabelKey = (levelKind: LineageLevelKind) => {
  switch (levelKind) {
    case LineageLevelKind.Service:
      return 'label.lineage-map-service-level';
    case LineageLevelKind.Database:
      return 'label.lineage-map-database-level';
    case LineageLevelKind.Schema:
      return 'label.lineage-map-schema-level';
    case LineageLevelKind.Table:
      return 'label.lineage-map-table-level';
    case LineageLevelKind.Topic:
      return 'label.lineage-map-topic-level';
    case LineageLevelKind.Dashboard:
      return 'label.lineage-map-dashboard-level';
    case LineageLevelKind.Model:
      return 'label.lineage-map-model-level';
    case LineageLevelKind.Pipeline:
      return 'label.lineage-map-pipeline-level';
    case LineageLevelKind.Container:
      return 'label.lineage-map-container-level';
    case LineageLevelKind.SearchIndex:
      return 'label.lineage-map-search-index-level';
    case LineageLevelKind.ApiEndpoint:
      return 'label.lineage-map-api-endpoint-level';
    case LineageLevelKind.Metric:
      return 'label.lineage-map-metric-level';
    case LineageLevelKind.Directory:
      return 'label.lineage-map-directory-level';
    case LineageLevelKind.File:
      return 'label.lineage-map-file-level';
    case LineageLevelKind.Spreadsheet:
      return 'label.lineage-map-spreadsheet-level';
    case LineageLevelKind.Worksheet:
      return 'label.lineage-map-worksheet-level';
    case LineageLevelKind.Column:
    case LineageLevelKind.Field:
      return 'label.lineage-map-field-level';
    case LineageLevelKind.Domain:
      return 'label.lineage-map-domain-level';
    case LineageLevelKind.DataProduct:
      return 'label.lineage-map-data-product-level';
    default:
      return 'label.lineage-map-asset-level';
  }
};

export const getSceneLevelLabelKey = (scene: LineageScene) => {
  if (scene.band === LineageBand.Field) {
    return 'label.lineage-map-field-level';
  }

  const visibleLevels = new Set(scene.nodes.map((node) => node.levelKind));
  const concreteLevels = new Set(
    [...visibleLevels].filter((levelKind) => {
      return !LENS_CONTAINER_LEVEL_KINDS.has(levelKind);
    })
  );
  const labelLevels = concreteLevels.size > 0 ? concreteLevels : visibleLevels;

  return labelLevels.size === 1
    ? getLevelLabelKey([...labelLevels][0])
    : getBandLabelKey(scene.band);
};

export const getDrillBand = (node: LineageSceneNode) => {
  if (node.band === LineageBand.Layer) {
    return LineageBand.Asset;
  }

  return ASSET_LEVEL_KINDS.has(node.levelKind)
    ? LineageBand.Field
    : LineageBand.Asset;
};

export const getBreadcrumbSceneRequest = (
  scene: LineageScene,
  breadcrumb: LineageSceneBreadcrumb
): LineageSceneRequest => {
  if (!breadcrumb.fullyQualifiedName) {
    return {
      lens: scene.lens,
      band: LineageBand.Layer,
    };
  }

  const isLensRoot =
    breadcrumb.levelKind === LineageLevelKind.Service ||
    breadcrumb.levelKind === LineageLevelKind.Domain ||
    breadcrumb.levelKind === LineageLevelKind.DataProduct;

  return {
    lens: scene.lens,
    band: isLensRoot ? LineageBand.Asset : breadcrumb.band,
    focusFqn: breadcrumb.fullyQualifiedName,
    entityType: breadcrumb.entityType,
  };
};

export const getParentSceneRequest = (
  scene: LineageScene
): LineageSceneRequest | undefined => {
  if (scene.band === LineageBand.Field && scene.focusFqn) {
    return {
      lens: scene.lens,
      band: LineageBand.Asset,
      focusFqn: scene.focusFqn,
      entityType: scene.focusEntityType,
    };
  }

  if (!scene.focusFqn) {
    return scene.band === LineageBand.Layer
      ? undefined
      : {
          lens: scene.lens,
          band: LineageBand.Layer,
        };
  }

  let currentIndex = -1;
  for (let index = scene.breadcrumb.length - 1; index >= 0; index--) {
    if (scene.breadcrumb[index].fullyQualifiedName === scene.focusFqn) {
      currentIndex = index;

      break;
    }
  }

  if (currentIndex > 1) {
    return getBreadcrumbSceneRequest(scene, scene.breadcrumb[currentIndex - 1]);
  }

  if (currentIndex === 1) {
    return {
      lens: scene.lens,
      band: LineageBand.Layer,
    };
  }

  return undefined;
};
