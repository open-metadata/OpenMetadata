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

import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowsUp,
  Home02,
  InfoCircle,
  LayersThree01,
  PlatformLineage,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import type { LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import { debounce } from 'lodash';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  applyNodeChanges,
  Background,
  Edge,
  MiniMap,
  Node,
  NodeTypes,
  Panel,
  ReactFlowInstance,
  ReactFlowProvider,
  type FitViewOptions,
  type Viewport,
} from 'reactflow';
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import {
  COLUMN_NODE_HEIGHT,
  LINEAGE_CHILD_ITEMS_PER_PAGE,
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  NODE_HEIGHT,
  NODE_HEIGHT_WITH_CHILDREN,
  NODE_WIDTH,
} from '../../../constants/Lineage.constants';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { EntityLineageNodeType, EntityType } from '../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
  LineageScene,
  LineageSceneBreadcrumb,
  LineageSceneEdge,
  LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import { PipelineViewMode } from '../../../generated/configuration/lineageSettings';
import { LineageLayer } from '../../../generated/settings/settings';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useLineageStore } from '../../../hooks/useLineageStore';
import {
  EntityChildren,
  LineageConfig,
  LineageNodeType,
} from '../../../interface/lineage.interface';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../../../interface/queryFilter.interface';
import type { LineageSceneFocus } from '../../../rest/lineageAPI';
import {
  getLineageEdgeDetails,
  getLineageScene,
} from '../../../rest/lineageAPI';
import { getQuickFilterQuery } from '../../../utils/ExplorePureUtils';
import { onEdgeClick } from '../../../utils/Lineage/handlers/edgeMutations';
import { onPaneClick } from '../../../utils/Lineage/handlers/nodeMutations';
import ELKLayout from '../../../utils/Lineage/Layout/ELKUtil/ELKUtil';
import { showErrorToast, showInfoToast } from '../../../utils/ToastUtils';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import SomethingWentWrongPlaceholder from '../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import Loader from '../../common/Loader/Loader';
import CustomNodeV1 from '../../Entity/EntityLineage/CustomNodeV1.component';
import LineageControlButtons from '../../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../../Entity/EntityLineage/LineageLayers/LineageLayers';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { LineageEditRequest } from '../AddLineagePopover/AddLineagePopover.interface';
import { CanvasLayerWrapper } from '../Edges/CanvasLayerWrapper/CanvasLayerWrapper';
import { LineageProps } from '../Lineage.interface';
import { useLineageHandlers } from '../Lineage/LineageHandlersContext';
import LineageSkeleton from '../LineageSkeleton.component';
import {
  buildLineagePathHighlightIndex,
  getBreadcrumbSceneRequest,
  getConnectedFieldLineagePathHighlight,
  getConnectedLineagePathHighlight,
  getDrillBand,
  getDrilledRootBreadcrumb,
  getLensRootLabelKey,
  getLineageMapEmptyState,
  getParentSceneRequest,
  getRailDrillFallbackNode,
  getRailStop,
  getRailStopLabelKey,
  getSceneFocus,
  getSceneLandingViewport,
  getSceneLevelLabelKey,
  getSceneNodeCount,
  getSceneNodeTypeSubtitle,
  getSceneOriginFocus,
  getSceneRequestFromSearch,
  getSceneSearch,
  getSemanticZoomDirection,
  isContainerSceneNode,
  isSceneNodeDrillable,
  LineageMapEmptyState,
  LINEAGE_MAP_RAIL_STOPS,
  type LineageSceneRequest,
} from './LineageMap.utils';
import {
  getEndpointHandle,
  getEndpointNodeId,
  getRealEntityRef,
  hydrateSelectedEdge,
  isEditableSceneEdge,
  toFlowEdges,
  type LineageMapEdgeData,
} from './LineageMapEdit.utils';
import { LineageSceneCache } from './LineageSceneCache.utils';

type ZoomGestureEvent = MouseEvent | TouchEvent;

const LINEAGE_MAP_ONBOARDING_COOKIE = 'lineageMapsOnboardingSeen';
const SEMANTIC_ZOOM_COOLDOWN = 450;
const PROGRAMMATIC_ZOOM_SUPPRESSION_MS = 1200;
const SCENE_MUTATION_MAX_ATTEMPTS = 5;
const SCENE_MUTATION_RETRY_DELAY_MS = 500;
const MAX_SCENE_DEPTH = 3;
const CONTROL_INSET_PADDING = 0.2;
// The lowest zoom a scene still reads at; a scene that would fit only below it
// opens there on its focus node instead (getSceneLandingViewport).
const SCENE_LAYER_FIT_VIEW_MIN_ZOOM = MIN_ZOOM_VALUE;
const SCENE_ASSET_FIT_VIEW_MIN_ZOOM = 0.55;
const SCENE_FIELD_FIT_VIEW_MIN_ZOOM = 0.9;
const SCENE_FIT_VIEW_MAX_ZOOM = 1;
// Containers carry a name, a subtitle and a count pill, so they take one width
// in every band; assets keep the wider default for their column lists.
const CONTAINER_NODE_WIDTH = 340;
const SCENE_LAYER_NODE_HEIGHT = 66;
const LINEAGE_MAP_RAIL_CLASSES = [
  'lineage-map-rail tw:group tw:absolute tw:right-6 tw:z-10 tw:flex tw:-translate-y-1/2',
  'tw:items-stretch tw:gap-2',
].join(' ');
const LINEAGE_MAP_RAIL_TRACK_CLASSES = [
  'tw:relative tw:flex tw:h-[138px] tw:w-[30px] tw:flex-col tw:items-center tw:justify-between tw:py-1',
  'tw:rounded-full tw:border tw:border-secondary tw:bg-surface tw:shadow-sm',
].join(' ');
// Hidden labels slide in while the rail is hovered or holds keyboard focus;
// a mouse click's lingering focus does not keep them open.
const LINEAGE_MAP_RAIL_LABEL_CLASSES = [
  'lineage-map-rail-label tw:h-auto! tw:whitespace-nowrap tw:rounded-full! tw:px-2.5! tw:py-0.5!',
  'tw:text-xs tw:shadow-xs tw:transition-[opacity,transform] tw:duration-150',
].join(' ');
const LINEAGE_MAP_RAIL_LABEL_HIDDEN_CLASSES = [
  'tw:pointer-events-none tw:translate-x-1.5 tw:opacity-0',
  'tw:group-hover:pointer-events-auto tw:group-hover:translate-x-0 tw:group-hover:opacity-100',
  'tw:group-has-[:focus-visible]:pointer-events-auto tw:group-has-[:focus-visible]:translate-x-0 tw:group-has-[:focus-visible]:opacity-100',
].join(' ');
const FIELD_NODE_HEIGHT =
  NODE_HEIGHT_WITH_CHILDREN +
  LINEAGE_CHILD_ITEMS_PER_PAGE * COLUMN_NODE_HEIGHT +
  110;
const BAND_DEPTH: Record<LineageBand, number> = {
  [LineageBand.Layer]: 0,
  [LineageBand.Asset]: 1,
  [LineageBand.Field]: 2,
};
const SCENE_LAYOUT_OPTIONS: Record<LineageBand, LayoutOptions> = {
  [LineageBand.Layer]: {
    'elk.spacing.componentComponent': '64',
    'elk.spacing.edgeEdge': '16',
    'elk.spacing.edgeNode': '24',
    'elk.spacing.nodeNode': '48',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
    'elk.layered.spacing.edgeNodeBetweenLayers': '28',
    'elk.layered.spacing.nodeNodeBetweenLayers': '150',
  },
  [LineageBand.Asset]: {
    'elk.spacing.componentComponent': '80',
    'elk.spacing.edgeEdge': '18',
    'elk.spacing.edgeNode': '28',
    'elk.spacing.nodeNode': '64',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '24',
    'elk.layered.spacing.edgeNodeBetweenLayers': '36',
    'elk.layered.spacing.nodeNodeBetweenLayers': '190',
  },
  [LineageBand.Field]: {
    'elk.spacing.componentComponent': '96',
    'elk.spacing.edgeEdge': '20',
    'elk.spacing.edgeNode': '32',
    'elk.spacing.nodeNode': '80',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '28',
    'elk.layered.spacing.edgeNodeBetweenLayers': '44',
    'elk.layered.spacing.nodeNodeBetweenLayers': '230',
  },
};

type SceneRequest = LineageSceneRequest;

interface SceneFlowNodeData {
  node: LineageNodeType;
  sceneNode: LineageSceneNode;
  sceneBand: LineageBand;
  nodeWidth: number;
  onSceneDrill?: (node: LineageSceneNode) => void;
  onSceneNodeSelect?: (nodeId: string) => void;
  sceneDrillLabel: string;
  isRootNode: boolean;
  hasOutgoers: boolean;
  hasIncomers: boolean;
  isUpstreamNode: boolean;
  isDownstreamNode: boolean;
  isPathHighlighted?: boolean;
  onSceneColumnHover?: (columnFqn?: string) => void;
  onSceneColumnSelect?: (columnFqn?: string) => void;
  isNodeRemovable?: boolean;
  isNodeEditable?: boolean;
  onSceneNodeRemove?: (node: { id: string }) => void;
  onSceneLineageEdit?: (request: LineageEditRequest) => void;
  onSceneShowFields?: () => void;
}

interface SceneNodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const nodeTypes: NodeTypes = {
  [EntityLineageNodeType.DEFAULT]: CustomNodeV1,
  [EntityLineageNodeType.INPUT]: CustomNodeV1,
  [EntityLineageNodeType.OUTPUT]: CustomNodeV1,
  [EntityLineageNodeType.NOT_CONNECTED]: CustomNodeV1,
};

const cookieStorage = new CookieStorage();

const getLineageMapOnboardingExpiry = () => {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);

  return expiry;
};

const getNodeHeight = (
  node: LineageSceneNode,
  sceneBand: LineageBand = node.band
) => {
  if (sceneBand === LineageBand.Layer) {
    return SCENE_LAYER_NODE_HEIGHT;
  }
  if (
    sceneBand === LineageBand.Asset &&
    !isContainerSceneNode(node) &&
    (node.childrenCount ?? 0) > 0
  ) {
    return NODE_HEIGHT_WITH_CHILDREN;
  }

  return sceneBand === LineageBand.Field && (node.fields ?? []).length > 0
    ? FIELD_NODE_HEIGHT
    : NODE_HEIGHT;
};

const getNodeWidth = (node: LineageSceneNode) =>
  isContainerSceneNode(node) ? CONTAINER_NODE_WIDTH : NODE_WIDTH;

const getSceneNodeBounds = (
  flowNodes: Node<SceneFlowNodeData>[],
  nodeIds?: string[]
): SceneNodeBounds | undefined => {
  const selectedNodeIds = nodeIds ? new Set(nodeIds) : undefined;
  const selectedNodes = flowNodes.filter(
    (node) => !selectedNodeIds || selectedNodeIds.has(node.id)
  );

  if (selectedNodes.length === 0) {
    return undefined;
  }

  const bounds = selectedNodes.reduce(
    (nodeBounds, node) => {
      const width = node.width ?? getNodeWidth(node.data.sceneNode);
      const height =
        node.height ?? getNodeHeight(node.data.sceneNode, node.data.sceneBand);

      return {
        minX: Math.min(nodeBounds.minX, node.position.x),
        minY: Math.min(nodeBounds.minY, node.position.y),
        maxX: Math.max(nodeBounds.maxX, node.position.x + width),
        maxY: Math.max(nodeBounds.maxY, node.position.y + height),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  };
};

const getSceneLayoutBoxes = (
  flowNodes: Node<SceneFlowNodeData>[],
  nodeIds?: string[]
) => {
  const selectedNodeIds = nodeIds ? new Set(nodeIds) : undefined;

  return flowNodes
    .filter((node) => !selectedNodeIds || selectedNodeIds.has(node.id))
    .map((node) => ({
      x: node.position.x,
      y: node.position.y,
      width: node.width ?? NODE_WIDTH,
      height: node.height ?? NODE_HEIGHT,
      isFocus: node.data.sceneNode.isFocus,
      isOrigin: node.data.sceneNode.isOrigin,
      isGhost: node.data.sceneNode.isGhost,
    }));
};

const getActiveLayersFromBand = (band: LineageBand) =>
  band === LineageBand.Field ? [LineageLayer.ColumnLevelLineage] : [];

const getSceneFitViewMinZoom = (band?: LineageBand) => {
  if (band === LineageBand.Layer) {
    return SCENE_LAYER_FIT_VIEW_MIN_ZOOM;
  }

  return band === LineageBand.Field
    ? SCENE_FIELD_FIT_VIEW_MIN_ZOOM
    : SCENE_ASSET_FIT_VIEW_MIN_ZOOM;
};

// Fit may zoom out as far as the graph needs: semantic zoom reads screen fill,
// so a small fit zoom no longer switches level by itself.
const getSceneFitViewOptions = (nodeIds?: string[]): FitViewOptions => ({
  maxZoom: SCENE_FIT_VIEW_MAX_ZOOM,
  minZoom: MIN_ZOOM_VALUE,
  nodes: nodeIds?.map((id) => ({ id })),
  padding: CONTROL_INSET_PADDING,
});

const getNextZoomBand = (band: LineageBand) => {
  switch (band) {
    case LineageBand.Layer:
      return LineageBand.Asset;
    case LineageBand.Asset:
      return LineageBand.Field;
    default:
      return LineageBand.Field;
  }
};

const getPreviousZoomBand = (band: LineageBand) => {
  switch (band) {
    case LineageBand.Field:
      return LineageBand.Asset;
    case LineageBand.Asset:
      return LineageBand.Layer;
    default:
      return LineageBand.Layer;
  }
};

const isDeeperBand = (currentBand: LineageBand, nextBand: LineageBand) =>
  BAND_DEPTH[nextBand] > BAND_DEPTH[currentBand];

export const getSceneCacheKey = (
  request: SceneRequest,
  config: LineageConfig,
  queryFilter = ''
) =>
  [
    request.lens,
    request.band,
    request.focusFqn ?? '',
    request.entityType ?? '',
    config.upstreamDepth,
    config.downstreamDepth,
    config.nodesPerLayer,
    config.pipelineViewMode,
    queryFilter,
  ].join('|');

const prefetchSceneBands = (
  currentScene: LineageScene,
  request: SceneRequest,
  config: LineageConfig,
  queryFilter: string,
  cache: LineageSceneCache
) => {
  const bands =
    currentScene.band === LineageBand.Asset
      ? [LineageBand.Layer, LineageBand.Field]
      : [LineageBand.Asset];
  for (const band of bands) {
    const nextRequest = { ...request, band };
    const key = getSceneCacheKey(nextRequest, config, queryFilter);
    cache
      .load(key, () => getLineageScene({ ...nextRequest, config, queryFilter }))
      .catch(() => undefined);
  }
};

const fitSceneBounds = (
  instance: ReactFlowInstance,
  bounds: SceneNodeBounds,
  landing?: Viewport
) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (landing) {
        instance.setViewport(landing);

        return;
      }
      instance.fitBounds(bounds, getSceneFitViewOptions());
    });
  });
};

const getHydratedSceneEdge = async (
  edge: Edge<LineageMapEdgeData>,
  sceneEdge: LineageSceneEdge,
  nodeById: Map<string, LineageSceneNode>
) => {
  const fromEntity = getRealEntityRef(
    nodeById.get(getEndpointNodeId(sceneEdge.from))
  );
  const toEntity = getRealEntityRef(
    nodeById.get(getEndpointNodeId(sceneEdge.to))
  );
  if (!fromEntity || !toEntity) {
    return null;
  }
  const details = await getLineageEdgeDetails(fromEntity.id, toEntity.id);

  return hydrateSelectedEdge(edge, sceneEdge, nodeById, details);
};

const getSemanticZoomBand = (
  band: LineageBand,
  previousZoom: number,
  zoom: number,
  flowNodes: Node<SceneFlowNodeData>[],
  screen?: DOMRect
) => {
  const graph = getSceneNodeBounds(flowNodes);
  if (!graph || !screen) {
    return band;
  }
  const card = {
    width: Math.max(
      ...flowNodes.map(
        (node) => node.width ?? getNodeWidth(node.data.sceneNode)
      )
    ),
    height: 0,
  };
  const direction = getSemanticZoomDirection({
    previousZoom,
    zoom,
    graph,
    card,
    screen,
    minZoom: MIN_ZOOM_VALUE,
    maxZoom: MAX_ZOOM_VALUE,
  });
  if (direction === 'in') {
    return getNextZoomBand(band);
  }

  return direction === 'out' ? getPreviousZoomBand(band) : band;
};

const getSceneChildren = (node: LineageSceneNode): EntityChildren =>
  (node.fields ?? []).map((field) => ({
    id: field.id,
    name: field.name,
    displayName: field.name,
    fullyQualifiedName: field.fullyQualifiedName ?? field.id,
    dataType: field.dataType,
  })) as EntityChildren;

const getSceneChildrenPatch = (
  sourceEntity: Partial<LineageNodeType>,
  entityType: string | undefined,
  children: EntityChildren
): Partial<LineageNodeType> => {
  if (children.length === 0) {
    return {};
  }

  switch (entityType) {
    case EntityType.TABLE:
    case EntityType.DASHBOARD_DATA_MODEL:
      return {
        columns: children as LineageNodeType['columns'],
        flattenChildren: children,
      };

    case EntityType.CONTAINER:
      return {
        dataModel: {
          ...sourceEntity.dataModel,
          columns: children,
        } as LineageNodeType['dataModel'],
        flattenChildren: children,
      };

    case EntityType.TOPIC:
      return {
        messageSchema: {
          ...sourceEntity.messageSchema,
          schemaFields: children,
        } as LineageNodeType['messageSchema'],
        flattenChildren: children,
      };

    case EntityType.API_ENDPOINT:
      return {
        responseSchema: {
          ...sourceEntity.responseSchema,
          schemaFields: children,
        } as LineageNodeType['responseSchema'],
        flattenChildren: children,
      };

    case EntityType.SEARCH_INDEX:
      return {
        fields: children as LineageNodeType['fields'],
        flattenChildren: children,
      };

    case EntityType.DASHBOARD:
      return {
        charts: children as LineageNodeType['charts'],
      };

    case EntityType.MLMODEL:
      return {
        mlFeatures: children as LineageNodeType['mlFeatures'],
      };

    default:
      return {
        flattenChildren: children,
      };
  }
};

const getLeafChildrenCount = (node: LineageSceneNode) =>
  isContainerSceneNode(node) ? undefined : node.childrenCount;

const toLineageNode = (
  node: LineageSceneNode,
  t: ReturnType<typeof useTranslation>['t']
): LineageNodeType => {
  const sourceEntity = (node.sourceEntity ?? {}) as Partial<LineageNodeType>;
  const entityType = sourceEntity.entityType ?? node.entityType;
  const children = getSceneChildren(node);

  return {
    ...sourceEntity,
    ...getSceneChildrenPatch(sourceEntity, entityType, children),
    id: node.id,
    name: sourceEntity.name ?? node.label,
    displayName: sourceEntity.displayName ?? node.displayName,
    fullyQualifiedName:
      sourceEntity.fullyQualifiedName ?? node.fullyQualifiedName,
    type: sourceEntity.type ?? entityType ?? node.levelKind,
    entityType: entityType as EntityType,
    deleted: sourceEntity.deleted ?? false,
    lineageMapSubtitle: getSceneNodeTypeSubtitle(node, t),
    lineageMapCount: getSceneNodeCount(node, t),
    lineageMapChildrenCount: getLeafChildrenCount(node),
    serviceType: sourceEntity.serviceType ?? node.serviceType,
    upstreamExpandPerformed: true,
    downstreamExpandPerformed: true,
    upstreamLineage: [],
  } as LineageNodeType;
};

const getColumnsHavingLineage = (edges: LineageScene['edges']) => {
  const columnsHavingLineage = new Map<string, Set<string>>();

  edges.forEach((edge) => {
    const sourceHandle = getEndpointHandle(edge.from);
    const targetHandle = getEndpointHandle(edge.to);

    if (sourceHandle) {
      const sourceNodeId = getEndpointNodeId(edge.from);
      const sourceColumns =
        columnsHavingLineage.get(sourceNodeId) ?? new Set<string>();
      sourceColumns.add(sourceHandle);
      columnsHavingLineage.set(sourceNodeId, sourceColumns);
    }

    if (targetHandle) {
      const targetNodeId = getEndpointNodeId(edge.to);
      const targetColumns =
        columnsHavingLineage.get(targetNodeId) ?? new Set<string>();
      targetColumns.add(targetHandle);
      columnsHavingLineage.set(targetNodeId, targetColumns);
    }
  });

  return columnsHavingLineage;
};

const layoutNodes = async (
  nodes: Node<SceneFlowNodeData>[],
  edges: Edge[],
  band: LineageBand
) => {
  const layoutedGraph = await ELKLayout.layoutGraph(
    nodes.map((node) => ({
      id: node.id,
      width: getNodeWidth(node.data.sceneNode),
      height: getNodeHeight(node.data.sceneNode, node.data.sceneBand),
    })),
    edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
    SCENE_LAYOUT_OPTIONS[band]
  );
  const layoutedMap = new Map(
    (layoutedGraph.children ?? []).map((node) => [node.id, node])
  );

  return nodes.map((node) => {
    const layoutedNode = layoutedMap.get(node.id);

    return {
      ...node,
      position: {
        x: layoutedNode?.x ?? 0,
        y: layoutedNode?.y ?? 0,
      },
    };
  });
};

const LineageMapOnboardingDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog
          className="lineage-map-onboarding-dialog"
          data-testid="lineage-map-onboarding-dialog"
          width={560}
          onClose={onClose}>
          <Dialog.Content className="lineage-map-onboarding-content tw:gap-0! tw:p-0!">
            <div className="lineage-map-onboarding-header tw:bg-linear-to-br tw:from-bg-brand-section tw:to-bg-brand-solid tw:px-8 tw:pt-7 tw:pb-6 tw:text-primary_on-brand">
              <span className="lineage-map-onboarding-eyebrow tw:mb-2 tw:block tw:text-xs tw:font-bold tw:leading-normal tw:tracking-widest tw:text-secondary_on-brand tw:uppercase">
                {t('label.lineage-map-onboarding-eyebrow')}
              </span>
              <span className="lineage-map-onboarding-title tw:block tw:text-display-xs tw:font-bold tw:leading-snug tw:text-primary_on-brand">
                {t('label.lineage-map-onboarding-title')}
              </span>
              <span className="lineage-map-onboarding-description tw:mt-2 tw:block tw:text-sm tw:leading-relaxed tw:text-secondary_on-brand">
                {t('message.lineage-map-onboarding-description')}
              </span>
            </div>
            <div className="lineage-map-onboarding-body tw:bg-overlay-surface tw:px-8 tw:pt-5 tw:pb-1">
              <div className="lineage-map-onboarding-row tw:grid tw:grid-cols-[44px_1fr] tw:gap-4 tw:border-b tw:border-secondary tw:pt-3 tw:pb-5">
                <span className="lineage-map-onboarding-icon tw:flex tw:size-9 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-primary tw:text-fg-brand-primary">
                  <ArrowsUp aria-hidden="true" className="tw:size-5" />
                </span>
                <div>
                  <span className="lineage-map-onboarding-row-title tw:block tw:text-md tw:font-bold tw:leading-snug tw:text-primary">
                    {t('label.altitude')}
                  </span>
                  <span className="lineage-map-onboarding-row-description tw:mt-0.5 tw:block tw:text-sm tw:leading-relaxed tw:text-tertiary">
                    {t('message.lineage-map-onboarding-altitude-description')}
                  </span>
                </div>
              </div>
              <div className="lineage-map-onboarding-row tw:grid tw:grid-cols-[44px_1fr] tw:gap-4 tw:pt-3 tw:pb-5">
                <span className="lineage-map-onboarding-icon tw:flex tw:size-9 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-primary tw:text-fg-brand-primary">
                  <LayersThree01 aria-hidden="true" className="tw:size-5" />
                </span>
                <div>
                  <span className="lineage-map-onboarding-row-title tw:block tw:text-md tw:font-bold tw:leading-snug tw:text-primary">
                    {t('label.layer')}
                  </span>
                  <span className="lineage-map-onboarding-row-description tw:mt-0.5 tw:block tw:text-sm tw:leading-relaxed tw:text-tertiary">
                    {t('message.lineage-map-onboarding-layer-description')}
                  </span>
                </div>
              </div>
            </div>
            <div className="lineage-map-onboarding-footer tw:flex tw:items-center tw:justify-between tw:gap-5 tw:bg-overlay-surface tw:px-8 tw:pt-5 tw:pb-7">
              <span className="lineage-map-onboarding-hint tw:text-sm tw:leading-normal tw:text-quaternary">
                {t('message.lineage-map-onboarding-hint')}
              </span>
              <Button
                className="lineage-map-onboarding-action tw:min-w-[112px] tw:font-bold"
                color="primary"
                onClick={onClose}>
                {t('label.explore')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const LineageMapControls = ({
  canDrill,
  miniMapVisible,
  scene,
  onStopSelect,
}: {
  canDrill: boolean;
  miniMapVisible: boolean;
  scene: LineageScene;
  onStopSelect: (stop: LineageBand) => void;
}) => {
  const { t } = useTranslation();
  const activeStop = getRailStop(scene);
  const stops = LINEAGE_MAP_RAIL_STOPS.map((stop) => ({
    stop,
    label: t(getRailStopLabelKey(stop, scene.lens)),
    isActive: stop === activeStop,
    isDisabled: isDeeperBand(activeStop, stop) && !canDrill,
  }));

  return (
    <div
      className={classNames(LINEAGE_MAP_RAIL_CLASSES, {
        'with-minimap': miniMapVisible,
      })}>
      <Box
        align="end"
        className="tw:h-[138px] tw:py-1"
        direction="col"
        justify="between">
        {stops.map(({ stop, label, isActive, isDisabled }) => (
          <Box align="center" className="tw:h-6" key={stop}>
            <Button
              className={classNames(LINEAGE_MAP_RAIL_LABEL_CLASSES, {
                'active tw:font-semibold tw:text-brand-secondary! tw:after:outline-brand':
                  isActive,
                [LINEAGE_MAP_RAIL_LABEL_HIDDEN_CLASSES]: !isActive,
              })}
              color="secondary"
              data-testid={`lineage-map-band-label-${stop}`}
              isDisabled={isDisabled}
              size="sm"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onStopSelect(stop);
              }}>
              {label}
            </Button>
          </Box>
        ))}
      </Box>
      <div className={LINEAGE_MAP_RAIL_TRACK_CLASSES}>
        <span
          aria-hidden="true"
          className="tw:absolute tw:top-3.5 tw:bottom-3.5 tw:left-1/2 tw:w-0.5 tw:-translate-x-1/2 tw:bg-quaternary"
        />
        {stops.map(({ stop, label, isActive, isDisabled }) => (
          <ButtonUtility
            aria-label={label}
            className="lineage-map-rail-button tw:z-1 tw:size-6 tw:p-0!"
            color="tertiary"
            data-testid={`lineage-map-band-${stop}`}
            icon={
              <span
                className={classNames(
                  'lineage-map-rail-dot tw:rounded-full tw:border-2 tw:transition-all tw:duration-150',
                  isActive
                    ? 'active tw:size-3.5 tw:border-brand tw:bg-brand-solid'
                    : 'tw:size-2.5 tw:border-primary tw:bg-surface'
                )}
              />
            }
            isDisabled={isDisabled}
            key={stop}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onStopSelect(stop);
            }}
          />
        ))}
      </div>
    </div>
  );
};

const LineageMapBreadcrumbs = ({
  scene,
  onBreadcrumbFocus,
}: {
  scene: LineageScene;
  onBreadcrumbFocus: (breadcrumb: LineageSceneBreadcrumb) => void;
}) => {
  const { t } = useTranslation();

  if (scene.breadcrumb.length === 0) {
    return null;
  }

  const breadcrumbById = new Map(
    scene.breadcrumb.map((breadcrumb) => [breadcrumb.id, breadcrumb])
  );
  const items = scene.breadcrumb.map((breadcrumb) => {
    const isRootBreadcrumb = !breadcrumb.fullyQualifiedName;

    return {
      id: breadcrumb.id,
      icon: isRootBreadcrumb ? Home02 : undefined,
      label: isRootBreadcrumb
        ? t(getLensRootLabelKey(scene.lens))
        : breadcrumb.label,
    };
  });

  return (
    <Panel className="lineage-map-breadcrumb-panel tw:z-10" position="top-left">
      <Breadcrumbs
        autoCollapse
        aria-label={t('label.navigation')}
        className="lineage-map-breadcrumbs tw:max-w-[min(760px,calc(100vw-520px))] tw:rounded-full tw:border tw:border-secondary tw:bg-surface tw:px-3 tw:py-2"
        data-testid="lineage-map-breadcrumbs"
        items={items}
        maxItemWidth={180}
        onAction={(id) => {
          const breadcrumb = breadcrumbById.get(String(id));
          if (breadcrumb) {
            onBreadcrumbFocus(breadcrumb);
          }
        }}
      />
    </Panel>
  );
};

// A drilled-in scene with nothing in it replaces the canvas, breadcrumb
// included, so the empty state carries the way back to the root.
const LineageMapEmptyPlaceholder = ({
  scene,
  onBack,
}: {
  scene?: LineageScene;
  onBack: (breadcrumb: LineageSceneBreadcrumb) => void;
}) => {
  const { t } = useTranslation();
  const rootBreadcrumb = getDrilledRootBreadcrumb(scene);

  return (
    <NoDataPlaceholder
      actions={
        rootBreadcrumb && scene
          ? [
              {
                key: 'back-to-root',
                label: t('label.back-to-entity', {
                  entity: t(getLensRootLabelKey(scene.lens)),
                }),
                color: 'secondary',
                iconLeading: Home02,
                onPress: () => onBack(rootBreadcrumb),
              },
            ]
          : undefined
      }
      icon={<PlatformLineage />}
      title={t('message.no-lineage-data-available')}
    />
  );
};

const LineageMapStatusPanel = ({
  scene,
  error,
}: {
  scene: LineageScene;
  error?: AxiosError;
}) => {
  const { t } = useTranslation();
  const { hiddenNodeCount = 0, sampled, nodes } = scene;
  const hasHiddenNodes = hiddenNodeCount > 0;
  if (!hasHiddenNodes && !sampled && !error) {
    return null;
  }

  return (
    <Panel
      className="lineage-map-status-panel tw:z-10 tw:flex tw:flex-col tw:items-end tw:gap-2"
      position="top-right">
      {(sampled || hasHiddenNodes) && (
        <Box
          align="center"
          className="tw:rounded-full tw:border tw:border-secondary tw:bg-surface tw:px-3 tw:py-1.5 tw:shadow-xs"
          data-testid="lineage-map-truncated-notice"
          gap={2}>
          <InfoCircle
            aria-hidden="true"
            className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary"
          />
          <Typography as="span" className="tw:text-secondary" size="text-sm">
            {t('label.showing-count-of-total-assets', {
              count: nodes.length,
              total: nodes.length + hiddenNodeCount,
            })}
          </Typography>
        </Box>
      )}
      {error && (
        <Alert title={t('message.something-went-wrong')} variant="error" />
      )}
    </Panel>
  );
};

const LineageMapCanvas = ({
  config,
  deleted,
  entity,
  entityType,
  isPlatformLineage,
}: {
  config: LineageConfig;
  deleted?: boolean;
  entity?: SourceType;
  entityType: LineageProps['entityType'];
  isPlatformLineage?: boolean;
}) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { isTourOpen, isTourPage, tourMockDatasetData } = useTourProvider();
  // The tour's table is mock data, so its scene is too — never ask the server.
  const tourLineageScene = isTourPage
    ? (tourMockDatasetData as { lineageScene?: LineageScene } | undefined)
        ?.lineageScene
    : undefined;
  const { activeDomain, isDomainRestricted } = useDomainStore();
  const { onNodeClick: onProviderNodeClick } = useLineageHandlers();
  const request = useMemo(
    () =>
      getSceneRequestFromSearch(
        location.search,
        getSceneFocus(entity?.fullyQualifiedName, entityType),
        isPlatformLineage
      ),
    [location.search, entity?.fullyQualifiedName, entityType, isPlatformLineage]
  );
  const [scene, setScene] = useState<LineageScene>();
  const [loading, setLoading] = useState(true);
  const [sceneError, setSceneError] = useState<AxiosError>();
  const [nodes, setNodes] = useState<Node<SceneFlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string>();
  const [hoveredFieldId, setHoveredFieldId] = useState<string>();
  const [pendingFitNodeIds, setPendingFitNodeIds] = useState<string[]>();
  const [miniMapVisible, setMiniMapVisible] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();
  const [sceneCache] = useState(() => new LineageSceneCache());
  const nodesRef = useRef<Node<SceneFlowNodeData>[]>([]);
  const onProviderNodeClickRef = useRef(onProviderNodeClick);
  const sceneRef = useRef<LineageScene>();
  const sceneRequestIdRef = useRef(0);
  const pendingFetchRef = useRef(false);
  const preserveViewportRef = useRef(false);
  const lastSemanticZoomAtRef = useRef(0);
  const previousZoomRef = useRef<number>();
  const semanticZoomSuppressedRef = useRef(false);
  const semanticZoomSuppressedUntilRef = useRef(0);
  const semanticZoomResumeTimerRef = useRef<number>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    activeLayer,
    lineageMutationTick,
    renderAllNodes,
    selectedColumn,
    selectedQuickFilters,
    setActiveLayer,
    setActiveNode,
    setCanEditLineage,
    setColumnsHavingLineage,
    setColumnsInCurrentPages,
    setIsPlatformLineage,
    setNodes: setSceneNodes,
    setSceneBand,
    setSelectedColumn,
    setSelectedEdge,
    setSelectedNode,
    setTracedColumns,
    updateActiveLayer,
  } = useLineageStore();
  const queryFilter = useMemo(() => {
    const quickFilterQuery = getQuickFilterQuery(selectedQuickFilters);
    const shouldScopeToDomain =
      isDomainRestricted && activeDomain !== DEFAULT_DOMAIN_VALUE;

    if (!shouldScopeToDomain) {
      return JSON.stringify(quickFilterQuery) ?? '';
    }

    const domainClause: QueryFieldInterface = {
      bool: {
        should: [
          { term: { 'domains.fullyQualifiedName': activeDomain } },
          {
            prefix: { 'domains.fullyQualifiedName': `${activeDomain}.` },
          } as QueryFieldInterface,
        ],
        minimum_should_match: 1,
      },
    };

    const existingMust = quickFilterQuery?.query?.bool?.must;
    let mustArray: QueryFieldInterface[] = [];
    if (Array.isArray(existingMust)) {
      mustArray = [...existingMust];
    } else if (existingMust) {
      mustArray = [existingMust];
    }

    const scopedQuery: QueryFilterInterface = {
      query: {
        bool: {
          ...quickFilterQuery?.query?.bool,
          must: [...mustArray, domainClause],
        },
      },
    };

    return JSON.stringify(scopedQuery);
  }, [selectedQuickFilters, activeDomain, isDomainRestricted]);
  const previousMutationTickRef = useRef(lineageMutationTick);
  // The platform map is view and export only; lineage is edited on asset tabs.
  useEffect(() => {
    setCanEditLineage(false);
  }, [setCanEditLineage]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    onProviderNodeClickRef.current = onProviderNodeClick;
  }, [onProviderNodeClick]);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    const keepsObservability = useLineageStore
      .getState()
      .activeLayer.includes(LineageLayer.DataObservability);
    setActiveLayer([
      ...getActiveLayersFromBand(request.band),
      ...(keepsObservability ? [LineageLayer.DataObservability] : []),
    ]);
    setIsPlatformLineage(Boolean(isPlatformLineage));
  }, [isPlatformLineage, request.band, setActiveLayer, setIsPlatformLineage]);

  // The page applies the configured default layer in the same commit, after
  // this map sets the band's layers, which drops the column layer the Field
  // band needs on a direct load or reload. Keyed on the layer array, not the
  // derived flag, because the flag flips back within one commit.
  useEffect(() => {
    if (
      request.band === LineageBand.Field &&
      !activeLayer.includes(LineageLayer.ColumnLevelLineage)
    ) {
      updateActiveLayer(LineageLayer.ColumnLevelLineage);
    }
  }, [activeLayer, request.band, updateActiveLayer]);

  useEffect(() => {
    setSceneBand(scene?.band);

    return () => setSceneBand(undefined);
  }, [scene?.band, setSceneBand]);

  const suppressSemanticZoom = useCallback(
    (durationMs = PROGRAMMATIC_ZOOM_SUPPRESSION_MS) => {
      const now = Date.now();
      semanticZoomSuppressedUntilRef.current = Math.max(
        semanticZoomSuppressedUntilRef.current,
        now + durationMs
      );
      semanticZoomSuppressedRef.current = true;
      if (semanticZoomResumeTimerRef.current) {
        window.clearTimeout(semanticZoomResumeTimerRef.current);
      }
      semanticZoomResumeTimerRef.current = window.setTimeout(() => {
        if (Date.now() < semanticZoomSuppressedUntilRef.current) {
          return;
        }
        previousZoomRef.current = reactFlowInstance?.getZoom();
        semanticZoomSuppressedRef.current = false;
      }, Math.max(durationMs, semanticZoomSuppressedUntilRef.current - now));
    },
    [reactFlowInstance]
  );

  const updateRequest = useCallback(
    (nextRequest: SceneRequest) => {
      suppressSemanticZoom();
      navigate(
        {
          search: getSceneSearch(location.search, nextRequest),
        },
        { replace: true }
      );
    },
    [location.search, navigate, suppressSemanticZoom]
  );

  const handleShowSceneFields = useCallback(
    () => updateRequest({ ...request, band: LineageBand.Field }),
    [request, updateRequest]
  );

  const handleOnboardingClose = useCallback(() => {
    cookieStorage.setItem(LINEAGE_MAP_ONBOARDING_COOKIE, 'true', {
      expires: getLineageMapOnboardingExpiry(),
      path: '/',
    });
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    const isOnboardingContext =
      Boolean(isPlatformLineage) && !deleted && !isTourOpen && !isTourPage;
    const hasSeenOnboarding =
      cookieStorage.getItem(LINEAGE_MAP_ONBOARDING_COOKIE) === 'true';
    setShowOnboarding(isOnboardingContext && !hasSeenOnboarding);
  }, [deleted, isPlatformLineage, isTourOpen, isTourPage]);

  const getOriginRequestTarget = useCallback(
    (currentScene?: LineageScene): LineageSceneFocus =>
      isPlatformLineage
        ? {}
        : getSceneOriginFocus(
            currentScene,
            getSceneFocus(entity?.fullyQualifiedName, entityType)
          ),
    [entity?.fullyQualifiedName, entityType, isPlatformLineage]
  );

  const fetchScene = useCallback(
    async (
      nextRequest: SceneRequest,
      options: { bypassCache?: boolean; preserveViewport?: boolean } = {}
    ) => {
      const requestId = sceneRequestIdRef.current + 1;
      sceneRequestIdRef.current = requestId;
      const cacheKey = getSceneCacheKey(nextRequest, config, queryFilter);
      const cachedScene = options.bypassCache
        ? undefined
        : sceneCache.get(cacheKey);
      preserveViewportRef.current = Boolean(options.preserveViewport);
      if (cachedScene) {
        // Clear the flag so the scene-layout effect's layoutNodes.then() is
        // allowed to call setLoading(false). Without this, a cache hit that
        // races an in-flight fetch leaves pendingFetchRef true indefinitely:
        // the stale response is dropped (request-id guard), the flag is never
        // cleared, and the loader stays stuck.
        pendingFetchRef.current = false;
        setScene(cachedScene);
        setSceneError(undefined);
        // setLoading(false) deferred to layoutNodes.then() in the scene useEffect
        // so the loader stays visible until nodes are positioned in the DOM.

        return cachedScene;
      }
      pendingFetchRef.current = true;
      setLoading(true);
      let response: LineageScene | undefined;
      try {
        response = await sceneCache.load(
          cacheKey,
          () =>
            tourLineageScene
              ? Promise.resolve(tourLineageScene)
              : getLineageScene({ ...nextRequest, config, queryFilter }),
          options.bypassCache
        );
        if (sceneRequestIdRef.current === requestId) {
          // Clear before setScene so the layout effect's .then() sees
          // pendingFetchRef.current === false and is allowed to clear the loader.
          pendingFetchRef.current = false;
          setScene(response);
          setSceneError(undefined);
          // setLoading(false) deferred to layoutNodes.then() in the scene
          // useEffect — the loader must stay up until ELK finishes positioning
          // nodes so that waitForAllLoadersToDisappear (in tests) and any
          // user-visible spinner correctly represent "graph ready", not just
          // "HTTP response received".
        }
      } catch (error) {
        if (sceneRequestIdRef.current === requestId) {
          pendingFetchRef.current = false;
          setSceneError(error as AxiosError);
          showErrorToast(error as AxiosError);
          // Error — no layout will run; clear the loader immediately.
          setLoading(false);
        }
      }

      return response;
    },
    [config, queryFilter, sceneCache, tourLineageScene]
  );
  const refetchCurrentScene = useCallback(
    async (isExpectedScene?: (response: LineageScene) => boolean) => {
      sceneCache.clear();
      for (let attempt = 0; attempt < SCENE_MUTATION_MAX_ATTEMPTS; attempt++) {
        const response = await fetchScene(request, {
          bypassCache: true,
          preserveViewport: true,
        });
        if (!isExpectedScene || (response && isExpectedScene(response))) {
          break;
        }
        if (attempt < SCENE_MUTATION_MAX_ATTEMPTS - 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, SCENE_MUTATION_RETRY_DELAY_MS);
          });
        }
      }
    },
    [fetchScene, request, sceneCache]
  );

  const prefetchAdjacentBands = useMemo(
    () =>
      debounce((currentScene: LineageScene) => {
        // The tour scene is a fixed mock; there is nothing to prefetch.
        if (tourLineageScene) {
          return;
        }
        prefetchSceneBands(
          currentScene,
          request,
          config,
          queryFilter,
          sceneCache
        );
      }, 300),
    [config, queryFilter, request, sceneCache, tourLineageScene]
  );

  useEffect(() => {
    fetchScene(request);

    return () => {
      sceneRequestIdRef.current++;
    };
  }, [fetchScene, request]);

  useEffect(() => {
    if (scene) {
      prefetchAdjacentBands(scene);
    }

    return () => prefetchAdjacentBands.cancel();
  }, [prefetchAdjacentBands, scene]);

  useEffect(() => {
    if (previousMutationTickRef.current === lineageMutationTick) {
      return;
    }
    previousMutationTickRef.current = lineageMutationTick;
    refetchCurrentScene();
  }, [lineageMutationTick, refetchCurrentScene]);

  // Asset pages stay on their own asset: moving through the scene hierarchy
  // is only offered from the main Lineage page.
  const handleDrill = useCallback(
    (node: LineageSceneNode) => {
      if (!isPlatformLineage || !isSceneNodeDrillable(node)) {
        return;
      }
      updateRequest({
        lens: request.lens,
        band: getDrillBand(node),
        focusFqn: node.fullyQualifiedName,
        entityType: node.entityType,
      });
    },
    [isPlatformLineage, request.lens, updateRequest]
  );

  const handleSceneColumnHover = useCallback((columnFqn?: string) => {
    setHoveredFieldId(columnFqn);
  }, []);

  const handleSceneColumnSelect = useCallback(
    (columnFqn?: string) => {
      setSelectedColumn(columnFqn);
      setHoveredFieldId(undefined);
    },
    [setSelectedColumn]
  );

  const handleSceneNodeSelect = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((candidate) => candidate.id === nodeId);
    if (node) {
      const entityRef = getRealEntityRef(node.data.sceneNode);
      if (entityRef) {
        onProviderNodeClickRef.current({
          ...node,
          data: {
            ...node.data,
            node: { ...node.data.node, id: entityRef.id },
          },
        });
      }
    }
  }, []);

  const fitViewWithoutSemanticZoom = useCallback(
    (nodeIds?: string[]) => {
      if (!reactFlowInstance) {
        return;
      }
      const nodeBounds = getSceneNodeBounds(nodes, nodeIds);
      if (!nodeBounds) {
        return;
      }
      suppressSemanticZoom();
      fitSceneBounds(
        reactFlowInstance,
        nodeBounds,
        getSceneLandingViewport(
          getSceneLayoutBoxes(nodes, nodeIds),
          {
            width: wrapperRef.current?.clientWidth ?? 0,
            height: wrapperRef.current?.clientHeight ?? 0,
          },
          getSceneFitViewMinZoom(scene?.band),
          CONTROL_INSET_PADDING
        )
      );
    },
    [nodes, reactFlowInstance, scene?.band, suppressSemanticZoom]
  );

  useEffect(
    () => () => {
      if (semanticZoomResumeTimerRef.current) {
        window.clearTimeout(semanticZoomResumeTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!scene) {
      setSceneNodes([]);
      // Only clear the loader when no fetch is in flight. On initial mount
      // scene is undefined while the first HTTP request is pending, so an
      // unconditional setLoading(false) here would dismiss the loader before
      // the graph is ready — the race this pendingFetchRef pattern exists to prevent.
      if (!pendingFetchRef.current) {
        setLoading(false);
      }

      return;
    }
    setHoveredEdge(null);
    setHoveredNodeId(undefined);
    setHoveredFieldId(undefined);
    setSelectedColumn(undefined);
    setTracedColumns(new Set());
    const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
    const nextEdges = toFlowEdges(
      nodeById,
      scene.edges,
      config.pipelineViewMode === PipelineViewMode.Node
    );
    setColumnsHavingLineage(getColumnsHavingLineage(scene.edges));
    setColumnsInCurrentPages(new Map());

    const nextNodes: Node<SceneFlowNodeData>[] = scene.nodes.map((node) => {
      const lineageNode = toLineageNode(node, t);

      return {
        connectable: false,
        id: node.id,
        type: EntityLineageNodeType.DEFAULT,
        width: getNodeWidth(node),
        height: getNodeHeight(node, scene.band),
        position: { x: 0, y: 0 },
        data: {
          node: lineageNode,
          sceneNode: node,
          sceneBand: scene.band,
          nodeWidth: getNodeWidth(node),
          onSceneDrill: isPlatformLineage ? handleDrill : undefined,
          onSceneNodeSelect: getRealEntityRef(node)
            ? handleSceneNodeSelect
            : undefined,
          sceneDrillLabel: t('label.zoom-in'),
          onSceneColumnHover: handleSceneColumnHover,
          onSceneColumnSelect: handleSceneColumnSelect,
          onSceneShowFields: handleShowSceneFields,
          isRootNode: Boolean(node.isOrigin || node.isFocus),
          hasOutgoers: false,
          hasIncomers: false,
          isUpstreamNode: false,
          isDownstreamNode: false,
        },
      };
    });
    setSceneNodes(nextNodes);
    let isMounted = true;
    layoutNodes(nextNodes, nextEdges, scene.band)
      .then((layoutedNodes) => {
        // Guard against both stale layout runs (isMounted) and spurious
        // re-layouts triggered while a newer fetch is still in flight
        // (pendingFetchRef). Without the pendingFetchRef check, deps like
        // callbacks changing simultaneously with a fetchScene call can
        // re-run this effect against the old scene; if that layout finishes
        // before the HTTP response, setLoading(false) fires prematurely and
        // waitForAllLoadersToDisappear returns before the new graph is ready.
        if (isMounted && !pendingFetchRef.current) {
          setNodes(layoutedNodes);
          setEdges(nextEdges);
          setLoading(false);
          if (preserveViewportRef.current) {
            preserveViewportRef.current = false;
          } else {
            setPendingFitNodeIds(layoutedNodes.map((node) => node.id));
          }
        }
      })
      .catch(() => {
        if (isMounted && !pendingFetchRef.current) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    config.pipelineViewMode,
    handleDrill,
    handleSceneColumnHover,
    handleSceneColumnSelect,
    handleSceneNodeSelect,
    handleShowSceneFields,
    isPlatformLineage,
    scene,
    setColumnsHavingLineage,
    setColumnsInCurrentPages,
    setSceneNodes,
    setSelectedColumn,
    setTracedColumns,
    t,
  ]);

  useEffect(() => {
    if (!pendingFitNodeIds) {
      return;
    }
    fitViewWithoutSemanticZoom(pendingFitNodeIds);
    setPendingFitNodeIds(undefined);
  }, [fitViewWithoutSemanticZoom, pendingFitNodeIds]);

  // Only drill into a node the user is plainly zooming into: the one under the
  // pointer for wheel and pinch, otherwise the selected node or the only
  // drillable node in view. Anything else stays a plain zoom.
  const pickZoomTargetNode = useCallback(
    (event?: ZoomGestureEvent | null) => {
      if (!reactFlowInstance || !wrapperRef.current) {
        return {};
      }
      const isDrillable = (node: Node<SceneFlowNodeData>) =>
        isSceneNodeDrillable(node.data.sceneNode);

      if (event && 'clientX' in event) {
        const point = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const underPointer = reactFlowInstance.getIntersectingNodes({
          ...point,
          width: 1,
          height: 1,
        }) as Node<SceneFlowNodeData>[];

        return {
          target: underPointer.find(isDrillable)?.data.sceneNode,
          leaf: underPointer.find((node) => !isDrillable(node))?.data.sceneNode,
        };
      }

      const selected = nodes.find((node) => node.selected && isDrillable(node));
      if (selected) {
        return { target: selected.data.sceneNode };
      }
      const rect = wrapperRef.current.getBoundingClientRect();
      const topLeft = reactFlowInstance.screenToFlowPosition({
        x: rect.left,
        y: rect.top,
      });
      const bottomRight = reactFlowInstance.screenToFlowPosition({
        x: rect.right,
        y: rect.bottom,
      });
      const visibleDrillable = reactFlowInstance
        .getIntersectingNodes({
          ...topLeft,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        })
        .filter(isDrillable);

      return {
        target:
          visibleDrillable.length === 1
            ? visibleDrillable[0].data.sceneNode
            : undefined,
      };
    },
    [nodes, reactFlowInstance]
  );

  // Moving to a deeper band drills into the scene focus, or into the node the
  // user is zooming into.
  const getDeeperBandDrillRequest = useCallback(
    (
      currentScene: LineageScene,
      band: LineageBand
    ): LineageSceneRequest | undefined => {
      if (!isDeeperBand(currentScene.band, band)) {
        return undefined;
      }
      const focus = getSceneFocus(
        currentScene.focusFqn,
        currentScene.focusEntityType
      );
      if (band === LineageBand.Asset && focus.focusFqn) {
        return { lens: currentScene.lens, band, ...focus };
      }
      const { target } = pickZoomTargetNode();
      if (!isSceneNodeDrillable(target)) {
        return undefined;
      }

      return {
        lens: currentScene.lens,
        band:
          band === LineageBand.Field ? getDrillBand(target) : LineageBand.Asset,
        focusFqn: target.fullyQualifiedName,
        entityType: target.entityType,
      };
    },
    [pickZoomTargetNode]
  );

  const handleBandChange = useCallback(
    (band: LineageBand) => {
      if (!scene || scene.band === band) {
        return;
      }
      const drillRequest = isPlatformLineage
        ? getDeeperBandDrillRequest(scene, band)
        : undefined;
      if (drillRequest) {
        updateRequest(drillRequest);

        return;
      }
      const originTarget = getOriginRequestTarget(scene);
      if (band !== LineageBand.Layer && !originTarget.focusFqn) {
        return;
      }
      updateRequest({
        lens: scene.lens,
        band,
        ...originTarget,
      });
    },
    [
      getDeeperBandDrillRequest,
      getOriginRequestTarget,
      isPlatformLineage,
      scene,
      updateRequest,
    ]
  );

  const handleRailStopSelect = useCallback(
    (stop: LineageBand) => {
      if (!scene || stop === getRailStop(scene)) {
        return;
      }
      // Databases and schemas are drawn in the Layer band but read as Data
      // Assets, so the first stop always returns to the lens's root level.
      if (stop === LineageBand.Layer) {
        updateRequest({ lens: scene.lens, band: LineageBand.Layer });

        return;
      }
      // Going deeper drills one level into a node, like zooming in: the one
      // the zoom would pick (selected / nearest the centre), else a fallback.
      if (isDeeperBand(getRailStop(scene), stop)) {
        const target =
          pickZoomTargetNode().target ?? getRailDrillFallbackNode(scene.nodes);
        if (target) {
          handleDrill(target);
        }

        return;
      }
      // Going up keeps the focus where the scene has a parent at that level
      // (Field -> Asset of the same entity), else opens the lens at that level.
      const parentRequest = getParentSceneRequest(scene);
      updateRequest(
        parentRequest?.band === stop
          ? parentRequest
          : { lens: scene.lens, band: stop }
      );
    },
    [handleDrill, pickZoomTargetNode, scene, updateRequest]
  );

  const handleSemanticZoomIn = useCallback(
    (event: ZoomGestureEvent | null) => {
      const { target, leaf } = pickZoomTargetNode(event);
      if (target) {
        handleDrill(target);
      } else if (leaf) {
        showInfoToast(
          t('message.lineage-node-no-deeper-level', {
            name: leaf.displayName ?? leaf.label,
          })
        );
      }
    },
    [handleDrill, pickZoomTargetNode, t]
  );

  const handleMove = useCallback(
    (event: ZoomGestureEvent | null, viewport: { zoom: number }) => {
      // Zoom only changes band on the main Lineage page.
      if (!isPlatformLineage || !scene || semanticZoomSuppressedRef.current) {
        previousZoomRef.current = viewport.zoom;

        return;
      }
      const previousZoom = previousZoomRef.current ?? viewport.zoom;
      previousZoomRef.current = viewport.zoom;
      const now = Date.now();
      if (now - lastSemanticZoomAtRef.current < SEMANTIC_ZOOM_COOLDOWN) {
        return;
      }
      const nextBand = getSemanticZoomBand(
        scene.band,
        previousZoom,
        viewport.zoom,
        nodesRef.current,
        wrapperRef.current?.getBoundingClientRect()
      );
      if (nextBand === scene.band) {
        return;
      }
      lastSemanticZoomAtRef.current = now;
      if (isDeeperBand(scene.band, nextBand)) {
        handleSemanticZoomIn(event);
      } else {
        const parentRequest = getParentSceneRequest(scene);
        if (parentRequest) {
          updateRequest(parentRequest);

          return;
        }
        handleBandChange(nextBand);
      }
    },
    [
      handleBandChange,
      handleSemanticZoomIn,
      isPlatformLineage,
      scene,
      updateRequest,
    ]
  );

  const handleBreadcrumbFocus = useCallback(
    (breadcrumb: LineageSceneBreadcrumb) => {
      if (!scene) {
        return;
      }
      updateRequest(getBreadcrumbSceneRequest(scene, breadcrumb));
    },
    [scene, updateRequest]
  );

  const handleLensChange = useCallback(
    (lens: LineageLens, band = request.band) => {
      updateRequest({
        ...request,
        lens,
        band,
      });
    },
    [request, updateRequest]
  );

  const handleFitView = useCallback(() => {
    fitViewWithoutSemanticZoom();
  }, [fitViewWithoutSemanticZoom]);

  const pathHighlightIndex = useMemo(
    () =>
      buildLineagePathHighlightIndex(
        (scene?.edges ?? []).map((edge) => ({
          id: edge.id,
          source: getEndpointNodeId(edge.from),
          target: getEndpointNodeId(edge.to),
          sourceHandle: getEndpointHandle(edge.from),
          targetHandle: getEndpointHandle(edge.to),
        }))
      ),
    [scene?.edges]
  );
  const activeFieldId =
    scene?.band === LineageBand.Field ? selectedColumn ?? hoveredFieldId : '';
  const fieldPathHighlight = useMemo(
    () =>
      getConnectedFieldLineagePathHighlight(activeFieldId, pathHighlightIndex),
    [activeFieldId, pathHighlightIndex]
  );
  const nodePathHighlight = useMemo(
    () => getConnectedLineagePathHighlight(hoveredNodeId, pathHighlightIndex),
    [hoveredNodeId, pathHighlightIndex]
  );
  const pathHighlight = fieldPathHighlight ?? nodePathHighlight;

  useEffect(() => {
    if (scene?.band !== LineageBand.Field) {
      setTracedColumns(new Set());

      return;
    }

    setTracedColumns(fieldPathHighlight?.fieldIds ?? new Set());
  }, [fieldPathHighlight, scene?.band, setTracedColumns]);

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const isPathHighlighted = pathHighlight?.nodeIds.has(node.id) ?? false;

        return {
          ...node,
          className: classNames(node.className, {
            'lineage-path-highlight': isPathHighlighted,
          }),
        };
      }),
    [nodes, pathHighlight]
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<SceneFlowNodeData>) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'button, input, a, .react-flow__handle, .column-container'
        )
      ) {
        return;
      }
      handleDrill(node.data.sceneNode);
    },
    [handleDrill]
  );

  const handleEdgeClick = useCallback(
    async (flowEdge: Edge, _event: MouseEvent) => {
      if (!scene) {
        return;
      }
      const edge = flowEdge as Edge<LineageMapEdgeData>;
      const sceneEdge =
        edge.data?.sceneEdge ??
        scene.edges.find((candidate) => candidate.id === edge.id);
      if (!sceneEdge) {
        return;
      }
      const nodeById = new Map(
        nodesRef.current.map((node) => [node.id, node.data.sceneNode])
      );
      const isEditable = isEditableSceneEdge(sceneEdge, nodeById);
      if (!isEditable) {
        onEdgeClick(edge);

        return;
      }

      try {
        const hydratedEdge = await getHydratedSceneEdge(
          edge,
          sceneEdge,
          nodeById
        );
        if (!hydratedEdge) {
          showInfoToast(t('message.no-lineage-data-available'));

          return;
        }
        setSelectedNode(undefined);
        setActiveNode(undefined);
        onEdgeClick(hydratedEdge);
      } catch (error) {
        if ((error as AxiosError).response?.status === 404) {
          showInfoToast(t('message.no-lineage-data-available'));
          await refetchCurrentScene();

          return;
        }
        showErrorToast(error as AxiosError);
      }
    },
    [refetchCurrentScene, scene, setActiveNode, setSelectedNode, t]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(undefined);
    setSelectedNode(undefined);
    setActiveNode(undefined);
    onPaneClick();
  }, [setActiveNode, setSelectedEdge, setSelectedNode]);

  // React Flow 11 does not pan to focused elements (12 adds autoPanOnNodeFocus) and
  // the canvas never scrolls, so bring an off-screen focus target into view.
  const handleCanvasFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const target = event.target;
      // Focus bubbles through React portals (drawer, modals, popovers); only
      // targets inside the canvas itself should move the view.
      if (
        !reactFlowInstance ||
        !(target instanceof HTMLElement) ||
        !event.currentTarget.contains(target)
      ) {
        return;
      }
      const pane = event.currentTarget.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      if (
        box.left >= pane.left &&
        box.right <= pane.right &&
        box.top >= pane.top &&
        box.bottom <= pane.bottom
      ) {
        return;
      }
      const center = reactFlowInstance.screenToFlowPosition({
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
      });
      reactFlowInstance.setCenter(center.x, center.y, {
        zoom: reactFlowInstance.getZoom(),
        duration: 200,
      });
    },
    [reactFlowInstance]
  );

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node<SceneFlowNodeData>) =>
      setHoveredNodeId(node.id),
    []
  );

  const handleNodeMouseLeave = useCallback(
    () => setHoveredNodeId(undefined),
    []
  );

  if (!scene || scene.nodes.length === 0) {
    const emptyStates: Record<LineageMapEmptyState, ReactNode> = {
      loading: <LineageSkeleton />,
      error: (
        <SomethingWentWrongPlaceholder
          onReload={() => fetchScene(request, { bypassCache: true })}
        />
      ),
      empty: (
        <LineageMapEmptyPlaceholder
          scene={scene}
          onBack={handleBreadcrumbFocus}
        />
      ),
    };

    // The placeholders fill their nearest positioned ancestor; this wrapper
    // keeps them to the canvas rather than the card that also holds the toolbar.
    return (
      <div className="tw:relative tw:h-full tw:w-full">
        {
          emptyStates[
            getLineageMapEmptyState({
              scene,
              loading,
              hasError: Boolean(sceneError),
            })
          ]
        }
      </div>
    );
  }

  const canDrillScene = scene.nodes.some(isSceneNodeDrillable);

  return (
    <ReactFlow
      fitView
      className="custom-react-flow lineage-map-react-flow tw:h-full tw:w-full tw:overflow-clip! tw:bg-primary"
      deleteKeyCode={null}
      edgeTypes={{}}
      edges={[]}
      fitViewOptions={{
        ...getSceneFitViewOptions(),
      }}
      maxZoom={MAX_ZOOM_VALUE}
      minZoom={MIN_ZOOM_VALUE}
      nodeTypes={nodeTypes}
      nodes={renderedNodes}
      nodesConnectable={false}
      onlyRenderVisibleElements={!renderAllNodes}
      ref={wrapperRef}
      selectNodesOnDrag={false}
      onFocus={handleCanvasFocus}
      onInit={setReactFlowInstance}
      onMove={handleMove}
      onNodeClick={handleNodeClick}
      onNodeMouseEnter={handleNodeMouseEnter}
      onNodeMouseLeave={handleNodeMouseLeave}
      onNodesChange={(changes) =>
        setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
      }
      onPaneClick={handlePaneClick}>
      {loading && (
        <div
          className="lineage-map-loading tw:absolute tw:inset-0 tw:z-30 tw:grid tw:place-items-center tw:bg-primary/80"
          data-testid="lineage-map-loading">
          <Loader />
        </div>
      )}
      <Background gap={18} size={1} />
      {miniMapVisible && (
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          position="bottom-right"
        />
      )}
      <CanvasLayerWrapper
        dqHighlightedEdges={new Set<string>()}
        edges={edges}
        hoverEdge={hoveredEdge}
        isPathHighlightActive={Boolean(pathHighlight)}
        nodes={renderedNodes}
        pathHighlightedEdgeIds={pathHighlight?.edgeIds}
        onEdgeClick={handleEdgeClick}
        onEdgeHover={setHoveredEdge}
      />
      {isPlatformLineage && (
        <>
          <LineageMapControls
            canDrill={canDrillScene}
            miniMapVisible={miniMapVisible}
            scene={scene}
            onStopSelect={handleRailStopSelect}
          />
          <LineageMapBreadcrumbs
            scene={scene}
            onBreadcrumbFocus={handleBreadcrumbFocus}
          />
          <LineageMapStatusPanel error={sceneError} scene={scene} />
        </>
      )}

      <LineageMapOnboardingDialog
        open={showOnboarding}
        onClose={handleOnboardingClose}
      />
      <Panel position="bottom-right">
        <LineageControlButtons
          miniMapVisible={miniMapVisible}
          reactFlowInstance={reactFlowInstance}
          onFitView={handleFitView}
          onToggleMiniMap={() => setMiniMapVisible((visible) => !visible)}
        />
      </Panel>
      <Panel className="lineage-layers-panel" position="bottom-left">
        <LineageLayers
          sceneLens={scene.lens}
          sceneLevelLabelKey={getSceneLevelLabelKey(scene)}
          onSceneLensChange={handleLensChange}
        />
      </Panel>
    </ReactFlow>
  );
};

const LineageMap = ({
  deleted,
  entity,
  entityType,
  isPlatformLineage,
}: LineageProps) => {
  const lineageConfig = useLineageStore((state) => state.lineageConfig);
  const config = useMemo<LineageConfig>(
    () => ({
      upstreamDepth: Math.min(
        lineageConfig.upstreamDepth ?? 1,
        MAX_SCENE_DEPTH
      ),
      downstreamDepth: Math.min(
        lineageConfig.downstreamDepth ?? 1,
        MAX_SCENE_DEPTH
      ),
      nodesPerLayer: 200,
      pipelineViewMode: lineageConfig.pipelineViewMode,
    }),
    [lineageConfig]
  );

  return (
    <ReactFlowProvider>
      <LineageMapCanvas
        config={config}
        deleted={deleted}
        entity={entity}
        entityType={entityType}
        isPlatformLineage={isPlatformLineage}
      />
    </ReactFlowProvider>
  );
};

export default LineageMap;
