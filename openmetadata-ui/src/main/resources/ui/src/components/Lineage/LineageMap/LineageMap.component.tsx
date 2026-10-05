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
  Badge,
  Breadcrumbs,
  Button,
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowsUp, Home02, LayersThree01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import type { LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SERVICE_TYPES } from '../../../constants/Services.constant';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityLineageNodeType, EntityType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
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
import { LineagePlatformView } from '../../../hooks/lineage/types';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useLineageStore } from '../../../hooks/useLineageStore';
import {
  EntityChildren,
  LineageConfig,
  LineageNodeType,
  type EdgeFromToData,
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
import {
  addLineageHandler,
  removeLineageHandler,
} from '../../../utils/EntityLineagePureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getQuickFilterQuery } from '../../../utils/ExplorePureUtils';
import {
  onColumnEdgeRemove,
  onEdgeClick,
} from '../../../utils/Lineage/handlers/edgeMutations';
import { onPaneClick } from '../../../utils/Lineage/handlers/nodeMutations';
import ELKLayout from '../../../utils/Lineage/Layout/ELKUtil/ELKUtil';
import { showErrorToast, showInfoToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import CustomNodeV1 from '../../Entity/EntityLineage/CustomNodeV1.component';
import LineageControlButtons from '../../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../../Entity/EntityLineage/LineageLayers/LineageLayers';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import AddLineagePopover from '../AddLineagePopover/AddLineagePopover';
import {
  AddLineageSelection,
  LineageEditRequest,
} from '../AddLineagePopover/AddLineagePopover.interface';
import { CanvasLayerWrapper } from '../Edges/CanvasLayerWrapper/CanvasLayerWrapper';
import { LineageProps } from '../Lineage.interface';
import { useLineageHandlers } from '../Lineage/LineageHandlersContext';
import LineageNodeDeleteModal from '../LineageNodeDeleteModal/LineageNodeDeleteModal';
import LineageSkeleton from '../LineageSkeleton.component';
import {
  buildLineagePathHighlightIndex,
  getBandLabelKey,
  getBreadcrumbSceneRequest,
  getConnectedFieldLineagePathHighlight,
  getConnectedLineagePathHighlight,
  getDeleteKeyAction,
  getDrillBand,
  getLensRootLabelKey,
  getLineageEditColumnPair,
  getParentSceneRequest,
  getSceneFocus,
  getSceneLevelLabelKey,
  getSceneNodeCount,
  getSceneNodeTypeSubtitle,
  getSceneOriginFocus,
  getSceneRequestFromSearch,
  getSceneSearch,
  isContainerSceneNode,
  useCloseOnViewportMove,
  type LineageSceneRequest,
} from './LineageMap.utils';
import {
  buildLineagePayload,
  findDeletableSelectedNode,
  getEndpointHandle,
  getEndpointNodeId,
  getRealEntityRef,
  hasSceneLineageEdge,
  hydrateSelectedEdge,
  isEditableSceneEdge,
  isEditableSceneNode,
  isRemovableSceneNode,
  toFlowEdges,
  type LineageMapEdgeData,
} from './LineageMapEdit.utils';
import { LineageSceneCache } from './LineageSceneCache.utils';

const LINEAGE_MAP_ONBOARDING_COOKIE = 'lineageMapsOnboardingSeen';
const ZOOM_IN_THRESHOLD = 1.9;
const ZOOM_OUT_THRESHOLD = 0.5;
const SEMANTIC_ZOOM_COOLDOWN = 450;
const PROGRAMMATIC_ZOOM_SUPPRESSION_MS = 1200;
const SCENE_MUTATION_MAX_ATTEMPTS = 5;
const SCENE_MUTATION_RETRY_DELAY_MS = 500;
const MAX_SCENE_DEPTH = 3;
const CONTROL_INSET_PADDING = 0.2;
const SCENE_LAYER_FIT_VIEW_MIN_ZOOM = MIN_ZOOM_VALUE;
const SCENE_ASSET_FIT_VIEW_MIN_ZOOM = 0.55;
const SCENE_FIELD_FIT_VIEW_MIN_ZOOM = 0.9;
const SCENE_FIT_VIEW_MAX_ZOOM = 1;
// Containers carry a name, a subtitle and a count pill, so they take one width
// in every band; assets keep the wider default for their column lists.
const CONTAINER_NODE_WIDTH = 340;
const SCENE_LAYER_NODE_HEIGHT = 66;
const LINEAGE_MAP_EMPTY_CLASSES =
  'lineage-map-empty tw:absolute tw:inset-0 tw:z-1 tw:grid tw:place-items-center tw:bg-transparent tw:text-tertiary';
const LINEAGE_MAP_RAIL_CLASSES = [
  'lineage-map-rail tw:absolute tw:top-1/2 tw:right-6 tw:z-10 tw:flex tw:w-8 tw:-translate-y-1/2',
  'tw:flex-col tw:items-center tw:rounded-full tw:border tw:border-secondary tw:bg-surface tw:py-1.5 tw:shadow-lg',
].join(' ');
const LINEAGE_MAP_RAIL_LABEL_CLASSES = [
  'lineage-map-rail-label tw:absolute tw:right-10 tw:max-w-[164px] tw:whitespace-nowrap tw:rounded-full',
  'tw:border tw:border-brand tw:bg-surface tw:px-2.5 tw:py-1 tw:text-sm tw:font-semibold tw:leading-normal',
  'tw:text-brand-tertiary',
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

const getSceneFitViewOptions = (
  band?: LineageBand,
  nodeIds?: string[]
): FitViewOptions => ({
  maxZoom: SCENE_FIT_VIEW_MAX_ZOOM,
  minZoom: getSceneFitViewMinZoom(band),
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

const isSceneNodeDrillable = (
  node?: LineageSceneNode
): node is LineageSceneNode & {
  fullyQualifiedName: string;
  entityType: string;
} => Boolean(node?.isExpandable && node.fullyQualifiedName && node.entityType);

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
  band?: LineageBand
) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      instance.fitBounds(bounds, getSceneFitViewOptions(band));
      window.requestAnimationFrame(() => {
        const minZoom = getSceneFitViewMinZoom(band);
        if (instance.getZoom() < minZoom) {
          instance.zoomTo(minZoom);
        }
      });
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

const getExistingEdgeDetails = async (fromId: string, toId: string) => {
  try {
    return await getLineageEdgeDetails(fromId, toId);
  } catch (error) {
    if ((error as AxiosError).response?.status !== 404) {
      throw error;
    }

    return undefined;
  }
};

const getSemanticZoomBand = (
  band: LineageBand,
  previousZoom: number,
  zoom: number
) => {
  if (zoom >= ZOOM_IN_THRESHOLD && previousZoom < ZOOM_IN_THRESHOLD) {
    return getNextZoomBand(band);
  }
  if (zoom <= ZOOM_OUT_THRESHOLD && previousZoom > ZOOM_OUT_THRESHOLD) {
    return getPreviousZoomBand(band);
  }

  return band;
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
  scene,
  onBandChange,
}: {
  canDrill: boolean;
  scene: LineageScene;
  onBandChange: (band: LineageBand) => void;
}) => {
  const { t } = useTranslation();
  const bandOptions = [LineageBand.Layer, LineageBand.Asset, LineageBand.Field];

  return (
    <div className={LINEAGE_MAP_RAIL_CLASSES}>
      <span
        aria-hidden="true"
        className="tw:absolute tw:top-5 tw:bottom-5 tw:left-1/2 tw:w-px tw:-translate-x-1/2 tw:bg-border-secondary"
      />
      {bandOptions.map((band) => {
        const isDeeperBandUnavailable =
          isDeeperBand(scene.band, band) && !canDrill;
        const isDisabled = isDeeperBandUnavailable;

        return (
          <ButtonUtility
            className="lineage-map-rail-button tw:z-1 tw:h-[30px] tw:w-6 tw:p-0!"
            color="tertiary"
            data-testid={`lineage-map-band-${band}`}
            icon={
              <span
                className={classNames(
                  'lineage-map-rail-dot tw:size-2 tw:rounded-full tw:border-2 tw:border-primary tw:bg-surface tw:transition-all tw:duration-150',
                  {
                    'active tw:size-3.5 tw:border-brand tw:bg-brand-solid':
                      scene.band === band,
                  }
                )}
              />
            }
            isDisabled={isDisabled}
            key={band}
            tooltip={
              isDeeperBandUnavailable
                ? t('label.zoom-in')
                : t(getBandLabelKey(band))
            }
            tooltipPlacement="left"
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onBandChange(band);
            }}
          />
        );
      })}
      <span className={LINEAGE_MAP_RAIL_LABEL_CLASSES}>
        {t(getSceneLevelLabelKey(scene))}
      </span>
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
  const items = scene.breadcrumb.map((breadcrumb, index) => {
    const isRootBreadcrumb = !breadcrumb.fullyQualifiedName;
    const label = isRootBreadcrumb
      ? t(getLensRootLabelKey(scene.lens))
      : breadcrumb.label;

    return {
      id: breadcrumb.id,
      icon: isRootBreadcrumb ? Home02 : undefined,
      label: (
        <Typography
          data-testid={`lineage-map-breadcrumb-${index}`}
          tooltip={label}>
          {label}
        </Typography>
      ),
    };
  });

  return (
    <Panel className="lineage-map-breadcrumb-panel tw:z-10" position="top-left">
      <Breadcrumbs
        autoCollapse
        aria-label={t('label.navigation')}
        className="lineage-map-breadcrumbs tw:max-w-[min(760px,calc(100vw-520px))] tw:rounded-full tw:border tw:border-secondary tw:bg-surface tw:px-3 tw:py-2 tw:shadow-lg"
        data-testid="lineage-map-breadcrumbs"
        items={items}
        maxItemWidth={180}
        size="sm"
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
    <Panel className="lineage-map-status-panel tw:z-10" position="top-right">
      {hasHiddenNodes && (
        <Badge color="gray" size="sm" type="color">
          {t('label.plus-count-more', { count: hiddenNodeCount })}
        </Badge>
      )}
      {(sampled || hasHiddenNodes) && (
        <Alert
          title={
            sampled
              ? t('label.showing-count-of-total-assets', {
                  count: nodes.length,
                  total: nodes.length + hiddenNodeCount,
                })
              : t('message.knowledge-graph-truncated')
          }
          variant="warning"
        />
      )}
      {error && (
        <Alert title={t('message.something-went-wrong')} variant="error" />
      )}
    </Panel>
  );
};

const LineageMapPlaceholder = ({
  scene,
  loading,
  error,
  onRetry,
}: {
  scene?: LineageScene;
  loading: boolean;
  error?: AxiosError;
  onRetry: () => void;
}) => {
  const { t } = useTranslation();
  if (loading && !scene) {
    return <LineageSkeleton />;
  }
  if (error && !scene) {
    return (
      <div className={LINEAGE_MAP_EMPTY_CLASSES}>
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <span>{t('message.something-went-wrong')}</span>
          <Button data-testid="lineage-map-retry" onClick={onRetry}>
            {t('label.try-again')}
          </Button>
        </ErrorPlaceHolder>
      </div>
    );
  }
  if (!scene) {
    return (
      <div className={LINEAGE_MAP_EMPTY_CLASSES}>
        <span>{t('message.no-lineage-data-available')}</span>
      </div>
    );
  }

  return (
    <div className={LINEAGE_MAP_EMPTY_CLASSES}>
      <ErrorPlaceHolder
        placeholderText={t('message.no-lineage-data-available')}
        type={ERROR_PLACEHOLDER_TYPE.FILTER}
      />
    </div>
  );
};

const LineageMapCanvas = ({
  config,
  deleted,
  entity,
  entityType,
  hasEditAccess,
  isPlatformLineage,
}: {
  config: LineageConfig;
  deleted?: boolean;
  entity?: SourceType;
  entityType: LineageProps['entityType'];
  hasEditAccess?: boolean;
  isPlatformLineage?: boolean;
}) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { isTourOpen, isTourPage } = useTourProvider();
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
  const [nodePendingDelete, setNodePendingDelete] = useState<{
    id: string;
    name: string;
  }>();
  const [isDeletingNode, setIsDeletingNode] = useState(false);
  const [lineageEditRequest, setLineageEditRequest] =
    useState<LineageEditRequest>();
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
    openDeleteModal,
    platformView,
    selectedColumn,
    selectedEdge,
    selectedNode,
    selectedQuickFilters,
    setActiveLayer,
    setActiveNode,
    setCanEditLineage,
    setColumnsHavingLineage,
    setColumnsInCurrentPages,
    setIsCreatingEdge,
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
  const canEditScene = useMemo(() => {
    const isEditableLineageView =
      Boolean(hasEditAccess) &&
      !deleted &&
      platformView === LineagePlatformView.None;

    return (
      isEditableLineageView &&
      !SERVICE_TYPES.includes(entityType as EntityType) &&
      scene?.band !== LineageBand.Layer
    );
  }, [hasEditAccess, deleted, platformView, entityType, scene?.band]);

  useEffect(() => {
    setCanEditLineage(canEditScene);
  }, [canEditScene, setCanEditLineage]);

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
    setActiveLayer(getActiveLayersFromBand(request.band));
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
          () => getLineageScene({ ...nextRequest, config, queryFilter }),
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
    [config, queryFilter, sceneCache]
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

  const removeSceneNode = useCallback(
    async (node: { id: string }) => {
      const currentScene = sceneRef.current;
      const flowNode = nodesRef.current.find(
        (candidate) => candidate.id === node.id
      );
      if (!currentScene || !flowNode) {
        return;
      }

      const nodeById = new Map(
        nodesRef.current.map((candidate) => [
          candidate.id,
          candidate.data.sceneNode,
        ])
      );
      const touchingEdges = currentScene.edges.filter(
        (edge) =>
          getEndpointNodeId(edge.from) === node.id ||
          getEndpointNodeId(edge.to) === node.id
      );
      if (
        !isRemovableSceneNode(
          flowNode.data.sceneNode,
          currentScene.edges,
          nodeById
        )
      ) {
        showInfoToast(t('label.zoom-in'));

        return;
      }

      const edgesToDelete = new Map<
        string,
        {
          fromEntity: string;
          fromId: string;
          toEntity: string;
          toId: string;
        }
      >();
      touchingEdges.forEach((edge) => {
        const fromNode = nodeById.get(getEndpointNodeId(edge.from));
        const toNode = nodeById.get(getEndpointNodeId(edge.to));
        const fromEntity = fromNode ? getRealEntityRef(fromNode) : undefined;
        const toEntity = toNode ? getRealEntityRef(toNode) : undefined;
        if (!fromEntity || !toEntity || !isEditableSceneEdge(edge, nodeById)) {
          return;
        }
        edgesToDelete.set(`${fromEntity.id}:${toEntity.id}`, {
          fromEntity: fromEntity.type,
          fromId: fromEntity.id,
          toEntity: toEntity.type,
          toId: toEntity.id,
        });
      });

      try {
        for (const edgeData of edgesToDelete.values()) {
          await removeLineageHandler(edgeData);
        }
        setNodes((currentNodes) =>
          currentNodes.filter((candidate) => candidate.id !== node.id)
        );
        setSelectedNode(undefined);
        setSelectedEdge(undefined);
        if (edgesToDelete.size > 0) {
          await refetchCurrentScene();
        }
      } catch {
        return;
      }
    },
    [refetchCurrentScene, setSelectedEdge, setSelectedNode, t]
  );

  const requestNodeDelete = useCallback((node: { id: string }) => {
    const flowNode = nodesRef.current.find(
      (candidate) => candidate.id === node.id
    );
    if (!flowNode) {
      return;
    }
    setNodePendingDelete({
      id: node.id,
      name: getEntityName(flowNode.data.node),
    });
  }, []);

  const handleSceneLineageEdit = useCallback((request: LineageEditRequest) => {
    setLineageEditRequest(request);
  }, []);

  const confirmNodeDelete = useCallback(async () => {
    if (!nodePendingDelete) {
      return;
    }
    setIsDeletingNode(true);
    try {
      await removeSceneNode(nodePendingDelete);
    } finally {
      setIsDeletingNode(false);
      setNodePendingDelete(undefined);
    }
  }, [nodePendingDelete, removeSceneNode]);

  const prefetchAdjacentBands = useMemo(
    () =>
      debounce((currentScene: LineageScene) => {
        prefetchSceneBands(
          currentScene,
          request,
          config,
          queryFilter,
          sceneCache
        );
      }, 300),
    [config, queryFilter, request, sceneCache]
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
      fitSceneBounds(reactFlowInstance, nodeBounds, scene?.band);
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
        connectable: canEditScene && isEditableSceneNode(node),
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
          onSceneNodeRemove: requestNodeDelete,
          isNodeRemovable: isRemovableSceneNode(node, scene.edges, nodeById),
          isNodeEditable: canEditScene && isEditableSceneNode(node),
          onSceneLineageEdit: handleSceneLineageEdit,
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
        // requestNodeDelete changing simultaneously with a fetchScene call can
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
    canEditScene,
    config.pipelineViewMode,
    handleDrill,
    handleSceneColumnHover,
    handleSceneColumnSelect,
    handleSceneLineageEdit,
    handleSceneNodeSelect,
    requestNodeDelete,
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
    (event?: MouseEvent | TouchEvent | null) => {
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

  const handleSemanticZoomIn = useCallback(
    (event: MouseEvent | TouchEvent | null) => {
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
    (event: MouseEvent | TouchEvent | null, viewport: { zoom: number }) => {
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
        viewport.zoom
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

  const closeLineageEditRequest = useCallback(
    () => setLineageEditRequest(undefined),
    []
  );
  const handleMoveStart = useCloseOnViewportMove(
    Boolean(lineageEditRequest),
    closeLineageEditRequest
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
    (lens: LineageLens) => {
      updateRequest({
        ...request,
        lens,
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
        onEdgeClick({
          ...hydratedEdge,
          data: { ...hydratedEdge.data, isEditable: true },
        });
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

  const createLineageEdge = useCallback(
    async (
      fromEntity: EdgeFromToData,
      toEntity: EdgeFromToData,
      columnPair?: { fromColumn: string; toColumn: string }
    ): Promise<boolean> => {
      setIsCreatingEdge(true);
      try {
        const existingDetails = await getExistingEdgeDetails(
          fromEntity.id,
          toEntity.id
        );
        const payload = buildLineagePayload(
          fromEntity,
          toEntity,
          existingDetails,
          columnPair
        );
        if (!payload) {
          return false;
        }
        await addLineageHandler(payload);
        setSelectedEdge(undefined);
        setSelectedNode(undefined);
        await refetchCurrentScene((response) =>
          hasSceneLineageEdge(response, fromEntity.id, toEntity.id, columnPair)
        );

        return true;
      } catch (error) {
        if ((error as AxiosError).response?.status !== undefined) {
          showErrorToast(error as AxiosError);
        }

        return false;
      } finally {
        setIsCreatingEdge(false);
      }
    },
    [refetchCurrentScene, setIsCreatingEdge, setSelectedEdge, setSelectedNode]
  );

  const handleAddLineageSubmit = useCallback(
    async ({ entity: picked, columnFqn }: AddLineageSelection) => {
      const request = lineageEditRequest;
      const currentNode = nodesRef.current.find(
        (node) => node.id === request?.nodeId
      );
      const current = currentNode
        ? getRealEntityRef(currentNode.data.sceneNode)
        : undefined;
      if (!request || !current) {
        return false;
      }
      const isUpstream = request.direction === LineageDirection.Upstream;
      const columnPair = getLineageEditColumnPair(
        isUpstream,
        request.columnFqn,
        columnFqn
      );

      return isUpstream
        ? createLineageEdge(picked, current, columnPair)
        : createLineageEdge(current, picked, columnPair);
    },
    [createLineageEdge, lineageEditRequest]
  );

  const currentEditEntityId = useMemo(
    () =>
      getRealEntityRef(
        nodesRef.current.find((node) => node.id === lineageEditRequest?.nodeId)
          ?.data.sceneNode
      )?.id,
    [lineageEditRequest]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(undefined);
    setSelectedNode(undefined);
    setActiveNode(undefined);
    onPaneClick();
  }, [setActiveNode, setSelectedEdge, setSelectedNode]);

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      const deletableNode = findDeletableSelectedNode(
        nodesRef.current,
        selectedNode?.id
      );
      const action = getDeleteKeyAction(event, {
        canEdit: canEditScene,
        hasSelectedNode: Boolean(deletableNode),
        hasSelectedEdge: Boolean(selectedEdge?.data?.isEditable),
      });
      if (!action) {
        return;
      }
      event.preventDefault();
      if (action === 'node' && deletableNode) {
        requestNodeDelete(deletableNode);

        return;
      }
      if (selectedEdge?.data?.isColumnLineage) {
        onColumnEdgeRemove();
      } else {
        openDeleteModal();
      }
    };
    window.addEventListener('keydown', handleDeleteKey);

    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [
    canEditScene,
    openDeleteModal,
    requestNodeDelete,
    selectedEdge,
    selectedNode,
  ]);

  // React Flow 11 does not pan to focused elements (12 adds autoPanOnNodeFocus) and
  // the canvas never scrolls, so bring an off-screen focus target into view.
  const handleCanvasFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!reactFlowInstance || !(target instanceof HTMLElement)) {
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
    return (
      <LineageMapPlaceholder
        error={sceneError}
        loading={loading}
        scene={scene}
        onRetry={() => fetchScene(request, { bypassCache: true })}
      />
    );
  }

  const canDrillScene = scene.nodes.some(isSceneNodeDrillable);

  return (
    <ReactFlow
      fitView
      onlyRenderVisibleElements
      className="custom-react-flow lineage-map-react-flow tw:h-full tw:w-full tw:overflow-clip! tw:bg-primary"
      deleteKeyCode={null}
      edgeTypes={{}}
      edges={[]}
      fitViewOptions={{
        ...getSceneFitViewOptions(scene.band),
      }}
      maxZoom={MAX_ZOOM_VALUE}
      minZoom={MIN_ZOOM_VALUE}
      nodeTypes={nodeTypes}
      nodes={renderedNodes}
      nodesConnectable={false}
      ref={wrapperRef}
      selectNodesOnDrag={false}
      onFocus={handleCanvasFocus}
      onInit={setReactFlowInstance}
      onMove={handleMove}
      onMoveStart={handleMoveStart}
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
            scene={scene}
            onBandChange={handleBandChange}
          />
          <LineageMapBreadcrumbs
            scene={scene}
            onBreadcrumbFocus={handleBreadcrumbFocus}
          />
        </>
      )}
      <LineageMapStatusPanel error={sceneError} scene={scene} />
      <LineageMapOnboardingDialog
        open={showOnboarding}
        onClose={handleOnboardingClose}
      />
      <LineageNodeDeleteModal
        isDeleting={isDeletingNode}
        isOpen={Boolean(nodePendingDelete)}
        nodeName={nodePendingDelete?.name ?? ''}
        onCancel={() => setNodePendingDelete(undefined)}
        onConfirm={confirmNodeDelete}
      />
      <AddLineagePopover
        excludeEntityId={currentEditEntityId}
        request={lineageEditRequest}
        onClose={closeLineageEditRequest}
        onSubmit={handleAddLineageSubmit}
      />
      <Panel position="bottom-right">
        <LineageControlButtons
          miniMapVisible={miniMapVisible}
          reactFlowInstance={reactFlowInstance}
          onFitView={handleFitView}
          onToggleMiniMap={() => setMiniMapVisible((visible) => !visible)}
        />
      </Panel>
      <Panel position="bottom-left">
        <LineageLayers
          entity={entity}
          entityType={entityType}
          sceneBand={scene.band}
          sceneLens={scene.lens}
          sceneLevelLabelKey={getSceneLevelLabelKey(scene)}
          onSceneBandChange={handleBandChange}
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
  hasEditAccess,
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
        hasEditAccess={hasEditAccess}
        isPlatformLineage={isPlatformLineage}
      />
    </ReactFlowProvider>
  );
};

export default LineageMap;
