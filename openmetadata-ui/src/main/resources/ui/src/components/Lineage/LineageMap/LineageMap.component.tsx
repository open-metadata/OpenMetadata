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
} from '@openmetadata/ui-core-components';
import { Home02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import type { LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import { debounce, isEqual, uniqueId } from 'lodash';
import Qs from 'qs';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  applyNodeChanges,
  Background,
  Connection,
  Edge,
  MiniMap,
  Node,
  NodeTypes,
  Panel,
  ReactFlowInstance,
  ReactFlowProvider,
  type FitViewOptions,
} from 'reactflow';
import {
  COLUMN_NODE_HEIGHT,
  LINEAGE_CHILD_ITEMS_PER_PAGE,
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  NODE_HEIGHT,
  NODE_HEIGHT_WITH_CHILDREN,
  NODE_WIDTH,
} from '../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityLineageNodeType, EntityType } from '../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
  LineageLevelKind,
  LineageScene,
  LineageSceneBreadcrumb,
  LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import { EntityReference } from '../../../generated/entity/type';
import { LineageLayer } from '../../../generated/settings/settings';
import { LineageDetails } from '../../../generated/type/entityLineage';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useLineageStore } from '../../../hooks/useLineageStore';
import {
  getLineageEdgeDetails,
  getLineageScene,
} from '../../../rest/lineageAPI';
import {
  addLineageHandler,
  removeLineageHandler,
} from '../../../utils/EntityLineagePureUtils';
import ELKLayout from '../../../utils/Lineage/Layout/ELKUtil/ELKUtil';
import { showErrorToast, showInfoToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import CustomNodeV1 from '../../Entity/EntityLineage/CustomNodeV1.component';
import { LineageConfig } from '../../Entity/EntityLineage/EntityLineage.interface';
import LineageControlButtons from '../../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../../Entity/EntityLineage/LineageLayers/LineageLayers';
import { EntityChildren } from '../../Entity/EntityLineage/NodeChildren/NodeChildren.interface';
import NodeSuggestions from '../../Entity/EntityLineage/NodeSuggestions.component';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { CanvasLayerWrapper } from '../Edges/CanvasLayerWrapper/CanvasLayerWrapper';
import { LineageNodeType, LineageProps } from '../Lineage.interface';
import LineageNodeRemoveButton from '../LineageNodeRemoveButton';
import LineageSkeleton from '../LineageSkeleton.component';
import './lineage-map.less';
import {
  buildLineagePathHighlightIndex,
  getBandLabelKey,
  getBreadcrumbSceneRequest,
  getConnectedFieldLineagePathHighlight,
  getConnectedLineagePathHighlight,
  getDrillBand,
  getLensRootLabelKey,
  getParentSceneRequest,
  getSceneLevelLabelKey,
  getSceneNodeCountSubtitle,
} from './LineageMap.utils';
import {
  buildConnectPayload,
  getEndpointHandle,
  getEndpointNodeId,
  getRealEntityRef,
  hydrateSelectedEdge,
  isEditableSceneEdge,
  isEditableSceneNode,
  isRemovableSceneNode,
  toFlowEdge,
  type LineageMapEdgeData,
} from './LineageMapEdit.utils';

const LINEAGE_MAP_ONBOARDING_COOKIE = 'lineageMapsOnboardingSeen';
const ZOOM_IN_THRESHOLD = 1.9;
const ZOOM_OUT_THRESHOLD = 0.5;
const SEMANTIC_ZOOM_COOLDOWN = 450;
const PROGRAMMATIC_ZOOM_SUPPRESSION_MS = 1200;
const SCENE_CACHE_LIMIT = 50;
const MAX_SCENE_DEPTH = 3;
const CONTROL_INSET_PADDING = 0.2;
const SCENE_LAYER_FIT_VIEW_MIN_ZOOM = MIN_ZOOM_VALUE;
const SCENE_ASSET_FIT_VIEW_MIN_ZOOM = 0.55;
const SCENE_FIELD_FIT_VIEW_MIN_ZOOM = 0.9;
const SCENE_FIT_VIEW_MAX_ZOOM = 1;
const SCENE_LAYER_NODE_WIDTH = 262;
const SCENE_LAYER_NODE_HEIGHT = 66;
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

interface SceneRequest {
  lens: LineageLens;
  band: LineageBand;
  focusFqn?: string;
  entityType?: string;
}

interface SceneFlowNodeData {
  node: LineageNodeType;
  sceneNode: LineageSceneNode;
  sceneBand: LineageBand;
  nodeWidth: number;
  onSceneDrill: (node: LineageSceneNode) => void;
  sceneDrillLabel: string;
  isRootNode: boolean;
  hasOutgoers: boolean;
  hasIncomers: boolean;
  isUpstreamNode: boolean;
  isDownstreamNode: boolean;
  isPathHighlighted?: boolean;
  onSceneColumnHover?: (columnFqn?: string) => void;
  onSceneColumnSelect?: (columnFqn?: string) => void;
  isNewNode?: boolean;
  isNodeRemovable?: boolean;
  label?: ReactNode;
  onSceneNodeRemove?: (node: { id: string }) => void;
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

const getNodeWidth = (
  node: LineageSceneNode,
  sceneBand: LineageBand = node.band
) => {
  return sceneBand === LineageBand.Layer ? SCENE_LAYER_NODE_WIDTH : NODE_WIDTH;
};

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
      const width =
        node.width ?? getNodeWidth(node.data.sceneNode, node.data.sceneBand);
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

const getSceneFitViewMinZoom = (band?: LineageBand) =>
  band === LineageBand.Layer
    ? SCENE_LAYER_FIT_VIEW_MIN_ZOOM
    : band === LineageBand.Field
    ? SCENE_FIELD_FIT_VIEW_MIN_ZOOM
    : SCENE_ASSET_FIT_VIEW_MIN_ZOOM;

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
): node is LineageSceneNode =>
  Boolean(node?.isExpandable && node.fullyQualifiedName);

export const getSceneCacheKey = (
  request: SceneRequest,
  config: LineageConfig
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
  ].join('|');

const getCachedScene = (
  cache: Map<string, LineageScene>,
  key: string
): LineageScene | undefined => {
  const cachedScene = cache.get(key);
  if (!cachedScene) {
    return undefined;
  }
  cache.delete(key);
  cache.set(key, cachedScene);

  return cachedScene;
};

const setCachedScene = (
  cache: Map<string, LineageScene>,
  key: string,
  value: LineageScene
) => {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > SCENE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
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
          ...(sourceEntity.dataModel ?? {}),
          columns: children,
        } as LineageNodeType['dataModel'],
        flattenChildren: children,
      };

    case EntityType.TOPIC:
      return {
        messageSchema: {
          ...(sourceEntity.messageSchema ?? {}),
          schemaFields: children,
        } as LineageNodeType['messageSchema'],
        flattenChildren: children,
      };

    case EntityType.API_ENDPOINT:
      return {
        responseSchema: {
          ...(sourceEntity.responseSchema ?? {}),
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
    lineageMapSubtitle: getSceneNodeCountSubtitle(node, t),
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
      width: getNodeWidth(node.data.sceneNode, node.data.sceneBand),
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
          <Dialog.Content className="lineage-map-onboarding-content">
            <div className="lineage-map-onboarding-header">
              <span className="lineage-map-onboarding-eyebrow">
                {t('label.lineage-map-onboarding-eyebrow')}
              </span>
              <span className="lineage-map-onboarding-title">
                {t('label.lineage-map-onboarding-title')}
              </span>
              <span className="lineage-map-onboarding-description">
                {t('message.lineage-map-onboarding-description')}
              </span>
            </div>
            <div className="lineage-map-onboarding-body">
              <div className="lineage-map-onboarding-row">
                <span
                  aria-hidden="true"
                  className="lineage-map-onboarding-icon altitude"
                />
                <div>
                  <span className="lineage-map-onboarding-row-title">
                    {t('label.altitude')}
                  </span>
                  <span className="lineage-map-onboarding-row-description">
                    {t('message.lineage-map-onboarding-altitude-description')}
                  </span>
                </div>
              </div>
              <div className="lineage-map-onboarding-row">
                <span
                  aria-hidden="true"
                  className="lineage-map-onboarding-icon layer"
                />
                <div>
                  <span className="lineage-map-onboarding-row-title">
                    {t('label.layer')}
                  </span>
                  <span className="lineage-map-onboarding-row-description">
                    {t('message.lineage-map-onboarding-layer-description')}
                  </span>
                </div>
              </div>
            </div>
            <div className="lineage-map-onboarding-footer">
              <span className="lineage-map-onboarding-hint">
                {t('message.lineage-map-onboarding-hint')}
              </span>
              <Button
                className="lineage-map-onboarding-action"
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
  isEditMode,
  scene,
  onBandChange,
}: {
  canDrill: boolean;
  isEditMode: boolean;
  scene: LineageScene;
  onBandChange: (band: LineageBand) => void;
}) => {
  const { t } = useTranslation();
  const bandOptions = [LineageBand.Layer, LineageBand.Asset, LineageBand.Field];

  return (
    <div className="lineage-map-rail">
      {bandOptions.map((band) => {
        const isDeeperBandUnavailable =
          isDeeperBand(scene.band, band) && !canDrill;
        const isDisabled = isEditMode || isDeeperBandUnavailable;

        return (
          <ButtonUtility
            className="lineage-map-rail-button"
            color="tertiary"
            data-testid={`lineage-map-band-${band}`}
            icon={
              <span
                className={
                  scene.band === band
                    ? 'lineage-map-rail-dot active'
                    : 'lineage-map-rail-dot'
                }
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
      <span className="lineage-map-rail-label">
        {t(getSceneLevelLabelKey(scene))}
      </span>
    </div>
  );
};

const LineageMapBreadcrumbs = ({
  isEditMode,
  scene,
  onBreadcrumbFocus,
}: {
  isEditMode: boolean;
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
        <span data-testid={`lineage-map-breadcrumb-${index}`} title={label}>
          {label}
        </span>
      ),
    };
  });

  return (
    <Panel className="lineage-map-breadcrumb-panel" position="top-left">
      <Breadcrumbs
        autoCollapse
        aria-label={t('label.navigation')}
        className="lineage-map-breadcrumbs"
        data-testid="lineage-map-breadcrumbs"
        items={items}
        maxItemWidth={180}
        size="sm"
        onAction={
          isEditMode
            ? undefined
            : (id) => {
                const breadcrumb = breadcrumbById.get(String(id));
                if (breadcrumb) {
                  onBreadcrumbFocus(breadcrumb);
                }
              }
        }
      />
    </Panel>
  );
};

const LineageMapCanvas = ({
  config,
  entity,
  entityType,
  isPlatformLineage,
}: {
  config: LineageConfig;
  entity?: SourceType;
  entityType: LineageProps['entityType'];
  isPlatformLineage?: boolean;
}) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const {
    onAddPipelineClick,
    onColumnEdgeRemove,
    onEdgeClick: onProviderEdgeClick,
    onPaneClick: onProviderPaneClick,
  } = useLineageProvider();
  const queryParams = useMemo(
    () => Qs.parse(location.search, { ignoreQueryPrefix: true }),
    [location.search]
  );
  const lineageLensParam =
    typeof queryParams.lineageLens === 'string'
      ? queryParams.lineageLens
      : undefined;
  const lineageBandParam =
    typeof queryParams.lineageBand === 'string'
      ? queryParams.lineageBand
      : undefined;
  const initialLens =
    lineageLensParam &&
    Object.values(LineageLens).includes(lineageLensParam as LineageLens)
      ? (lineageLensParam as LineageLens)
      : LineageLens.Service;
  const initialBand =
    lineageBandParam &&
    Object.values(LineageBand).includes(lineageBandParam as LineageBand)
      ? (lineageBandParam as LineageBand)
      : isPlatformLineage
      ? LineageBand.Layer
      : LineageBand.Asset;
  const [request, setRequest] = useState<SceneRequest>({
    lens: initialLens,
    band: initialBand,
    focusFqn:
      typeof queryParams.lineageFocus === 'string'
        ? queryParams.lineageFocus
        : entity?.fullyQualifiedName,
    entityType:
      typeof queryParams.lineageEntityType === 'string'
        ? queryParams.lineageEntityType
        : entityType,
  });
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
  const cacheRef = useRef(new Map<string, LineageScene>());
  const nodesRef = useRef<Node<SceneFlowNodeData>[]>([]);
  const sceneRef = useRef<LineageScene>();
  const sceneRequestIdRef = useRef(0);
  const preserveViewportRef = useRef(false);
  const lastSemanticZoomAtRef = useRef(0);
  const previousZoomRef = useRef<number>();
  const semanticZoomSuppressedRef = useRef(false);
  const semanticZoomSuppressedUntilRef = useRef(0);
  const semanticZoomResumeTimerRef = useRef<number>();
  const hoverFrameRef = useRef<number>();
  const pendingHoverPointRef = useRef<{ x: number; y: number }>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    lineageMutationTick,
    isEditMode,
    selectedColumn,
    selectedNode,
    setActiveLayer,
    setActiveNode,
    setColumnsHavingLineage,
    setColumnsInCurrentPages,
    setIsCreatingEdge,
    setIsPlatformLineage,
    setSceneBand,
    setSelectedColumn,
    setSelectedEdge,
    setSelectedNode,
    setTracedColumns,
  } = useLineageStore();
  const previousMutationTickRef = useRef(lineageMutationTick);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    setActiveLayer(getActiveLayersFromBand(request.band));
    setIsPlatformLineage(Boolean(isPlatformLineage));
  }, [
    isEditMode,
    isPlatformLineage,
    request.band,
    setActiveLayer,
    setIsPlatformLineage,
  ]);

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
      if (isEditMode) {
        return;
      }
      suppressSemanticZoom();
      setRequest((current) =>
        isEqual(current, nextRequest) ? current : nextRequest
      );
      const params = Qs.parse(location.search, {
        ignoreQueryPrefix: true,
      });
      params.lineageLens = nextRequest.lens;
      params.lineageBand = nextRequest.band;
      if (nextRequest.focusFqn) {
        params.lineageFocus = nextRequest.focusFqn;
      } else {
        delete params.lineageFocus;
      }
      if (nextRequest.entityType) {
        params.lineageEntityType = nextRequest.entityType;
      } else {
        delete params.lineageEntityType;
      }
      navigate(
        {
          search: Qs.stringify(params, {
            addQueryPrefix: true,
            encode: false,
          }),
        },
        { replace: true }
      );
    },
    [isEditMode, location.search, navigate, suppressSemanticZoom]
  );

  const handleOnboardingClose = useCallback(() => {
    cookieStorage.setItem(LINEAGE_MAP_ONBOARDING_COOKIE, 'true', {
      expires: getLineageMapOnboardingExpiry(),
    });
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    setShowOnboarding(
      cookieStorage.getItem(LINEAGE_MAP_ONBOARDING_COOKIE) !== 'true'
    );
  }, []);

  const getOriginRequestTarget = useCallback(
    (currentScene?: LineageScene) => ({
      entityType: isPlatformLineage
        ? undefined
        : currentScene?.originEntityType ?? entityType,
      focusFqn: isPlatformLineage
        ? undefined
        : currentScene?.originFqn ?? entity?.fullyQualifiedName,
    }),
    [entity?.fullyQualifiedName, entityType, isPlatformLineage]
  );

  const fetchScene = useCallback(
    async (
      nextRequest: SceneRequest,
      options: { bypassCache?: boolean; preserveViewport?: boolean } = {}
    ) => {
      const requestId = sceneRequestIdRef.current + 1;
      sceneRequestIdRef.current = requestId;
      const cacheKey = getSceneCacheKey(nextRequest, config);
      const cachedScene = options.bypassCache
        ? undefined
        : getCachedScene(cacheRef.current, cacheKey);
      if (cachedScene) {
        setScene(cachedScene);
        setSceneError(undefined);
        setLoading(false);

        return;
      }
      preserveViewportRef.current = Boolean(options.preserveViewport);
      setLoading(true);
      try {
        const response = await getLineageScene({
          ...nextRequest,
          config,
        });
        setCachedScene(cacheRef.current, cacheKey, response);
        if (sceneRequestIdRef.current === requestId) {
          setScene(response);
          setSceneError(undefined);
        }
      } catch (error) {
        if (sceneRequestIdRef.current === requestId) {
          setSceneError(error as AxiosError);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (sceneRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [config]
  );

  const refetchCurrentScene = useCallback(async () => {
    cacheRef.current.clear();
    await fetchScene(request, {
      bypassCache: true,
      preserveViewport: true,
    });
  }, [fetchScene, request]);

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
        !flowNode.data.isNewNode &&
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

  const prefetchAdjacentBands = useMemo(
    () =>
      debounce((currentScene: LineageScene) => {
        if (isEditMode) {
          return;
        }
        const bands =
          currentScene.band === LineageBand.Asset
            ? [LineageBand.Layer, LineageBand.Field]
            : [LineageBand.Asset];
        bands.forEach((band) => {
          const nextRequest = { ...request, band };
          const cacheKey = getSceneCacheKey(nextRequest, config);
          if (!cacheRef.current.has(cacheKey)) {
            getLineageScene({ ...nextRequest, config })
              .then((response) =>
                setCachedScene(cacheRef.current, cacheKey, response)
              )
              .catch(() => undefined);
          }
        });
      }, 300),
    [config, isEditMode, request]
  );

  useEffect(() => {
    fetchScene(request);
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

  const handleDrill = useCallback(
    (node: LineageSceneNode) => {
      if (!isSceneNodeDrillable(node)) {
        return;
      }
      updateRequest({
        lens: request.lens,
        band: getDrillBand(node),
        focusFqn: node.fullyQualifiedName,
        entityType: node.entityType,
      });
    },
    [request.lens, updateRequest]
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

  const fitViewWithoutSemanticZoom = useCallback(
    (nodeIds?: string[]) => {
      if (!reactFlowInstance) {
        return;
      }
      const nodeBounds = getSceneNodeBounds(nodes, nodeIds);
      if (!nodeBounds) {
        return;
      }
      const minZoom = getSceneFitViewMinZoom(scene?.band);
      suppressSemanticZoom();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          reactFlowInstance.fitBounds(
            nodeBounds,
            getSceneFitViewOptions(scene?.band)
          );
          window.requestAnimationFrame(() => {
            if (reactFlowInstance.getZoom() < minZoom) {
              reactFlowInstance.zoomTo(minZoom);
            }
          });
        });
      });
    },
    [nodes, reactFlowInstance, scene?.band, suppressSemanticZoom]
  );

  useEffect(
    () => () => {
      if (semanticZoomResumeTimerRef.current) {
        window.clearTimeout(semanticZoomResumeTimerRef.current);
      }
      if (hoverFrameRef.current) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!scene) {
      return;
    }
    setHoveredEdge(null);
    setHoveredNodeId(undefined);
    setHoveredFieldId(undefined);
    setSelectedColumn(undefined);
    setTracedColumns(new Set());
    const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
    const nextEdges = scene.edges.map((edge) => toFlowEdge(nodeById, edge));
    setColumnsHavingLineage(getColumnsHavingLineage(scene.edges));
    setColumnsInCurrentPages(new Map());

    const nextNodes: Node<SceneFlowNodeData>[] = scene.nodes.map((node) => {
      const lineageNode = toLineageNode(node, t);

      return {
        connectable:
          isEditMode &&
          scene.band !== LineageBand.Layer &&
          isEditableSceneNode(node),
        id: node.id,
        type: EntityLineageNodeType.DEFAULT,
        width: getNodeWidth(node, scene.band),
        height: getNodeHeight(node, scene.band),
        position: { x: 0, y: 0 },
        data: {
          node: lineageNode,
          sceneNode: node,
          sceneBand: scene.band,
          nodeWidth: getNodeWidth(node, scene.band),
          onSceneDrill: handleDrill,
          sceneDrillLabel: t('label.zoom-in'),
          onSceneColumnHover: handleSceneColumnHover,
          onSceneColumnSelect: handleSceneColumnSelect,
          onSceneNodeRemove: removeSceneNode,
          isNodeRemovable: isRemovableSceneNode(node, scene.edges, nodeById),
          isRootNode: Boolean(node.isOrigin || node.isFocus),
          hasOutgoers: false,
          hasIncomers: false,
          isUpstreamNode: false,
          isDownstreamNode: false,
        },
      };
    });
    let isMounted = true;
    layoutNodes(nextNodes, nextEdges, scene.band).then((layoutedNodes) => {
      if (isMounted) {
        setNodes(layoutedNodes);
        setEdges(nextEdges);
        if (preserveViewportRef.current) {
          preserveViewportRef.current = false;
        } else {
          setPendingFitNodeIds(layoutedNodes.map((node) => node.id));
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    handleDrill,
    handleSceneColumnHover,
    handleSceneColumnSelect,
    isEditMode,
    removeSceneNode,
    scene,
    setColumnsHavingLineage,
    setColumnsInCurrentPages,
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

  const pickCenterExpandableNode = useCallback(() => {
    if (!reactFlowInstance || !wrapperRef.current) {
      return scene?.nodes.find(isSceneNodeDrillable);
    }
    const rect = wrapperRef.current.getBoundingClientRect();
    const viewport = reactFlowInstance.getViewport();
    const center = {
      x: (rect.width / 2 - viewport.x) / viewport.zoom,
      y: (rect.height / 2 - viewport.y) / viewport.zoom,
    };

    return nodes
      .filter((node) => isSceneNodeDrillable(node.data.sceneNode))
      .sort((left, right) => {
        const leftDistance =
          Math.abs(left.position.x - center.x) +
          Math.abs(left.position.y - center.y);
        const rightDistance =
          Math.abs(right.position.x - center.x) +
          Math.abs(right.position.y - center.y);

        return leftDistance - rightDistance;
      })[0]?.data.sceneNode;
  }, [nodes, reactFlowInstance, scene]);

  const handleBandChange = useCallback(
    (band: LineageBand) => {
      if (!scene || scene.band === band) {
        return;
      }
      if (isDeeperBand(scene.band, band)) {
        if (
          band === LineageBand.Asset &&
          scene.focusFqn &&
          scene.focusEntityType
        ) {
          updateRequest({
            lens: scene.lens,
            band,
            focusFqn: scene.focusFqn,
            entityType: scene.focusEntityType,
          });

          return;
        }
        const target = pickCenterExpandableNode();
        if (isSceneNodeDrillable(target)) {
          updateRequest({
            lens: scene.lens,
            band:
              band === LineageBand.Field
                ? getDrillBand(target)
                : LineageBand.Asset,
            focusFqn: target.fullyQualifiedName,
            entityType: target.entityType,
          });

          return;
        }
      }
      const originTarget = getOriginRequestTarget(scene);
      if (band !== LineageBand.Layer && !originTarget.focusFqn) {
        return;
      }
      updateRequest({
        lens: scene.lens,
        band,
        focusFqn: originTarget.focusFqn,
        entityType: originTarget.entityType,
      });
    },
    [getOriginRequestTarget, pickCenterExpandableNode, scene, updateRequest]
  );

  const handleMove = useCallback(
    (_event: unknown, viewport: { zoom: number }) => {
      if (isEditMode) {
        previousZoomRef.current = viewport.zoom;

        return;
      }
      if (!scene) {
        previousZoomRef.current = viewport.zoom;

        return;
      }
      if (semanticZoomSuppressedRef.current) {
        previousZoomRef.current = viewport.zoom;

        return;
      }
      const previousZoom = previousZoomRef.current ?? viewport.zoom;
      previousZoomRef.current = viewport.zoom;
      const now = Date.now();
      if (now - lastSemanticZoomAtRef.current < SEMANTIC_ZOOM_COOLDOWN) {
        return;
      }
      if (
        viewport.zoom >= ZOOM_IN_THRESHOLD &&
        previousZoom < ZOOM_IN_THRESHOLD
      ) {
        const nextBand = getNextZoomBand(scene.band);
        if (nextBand === scene.band) {
          return;
        }
        lastSemanticZoomAtRef.current = now;
        const target = pickCenterExpandableNode();
        if (target) {
          handleDrill(target);

          return;
        }
        handleBandChange(nextBand);
      } else if (
        viewport.zoom <= ZOOM_OUT_THRESHOLD &&
        previousZoom > ZOOM_OUT_THRESHOLD
      ) {
        const previousBand = getPreviousZoomBand(scene.band);
        if (previousBand === scene.band) {
          return;
        }
        lastSemanticZoomAtRef.current = now;
        const parentRequest = getParentSceneRequest(scene);
        if (parentRequest) {
          updateRequest(parentRequest);

          return;
        }
        handleBandChange(previousBand);
      }
    },
    [
      handleBandChange,
      handleDrill,
      isEditMode,
      pickCenterExpandableNode,
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
    (lens: LineageLens) => {
      updateRequest({
        ...request,
        lens,
      });
    },
    [request, updateRequest]
  );

  const handleRecenterOrigin = useCallback(() => {
    if (!scene?.originFqn) {
      fitViewWithoutSemanticZoom();

      return;
    }
    updateRequest({
      lens: scene.lens,
      band: LineageBand.Asset,
      focusFqn: scene.originFqn,
      entityType: scene.originEntityType,
    });
  }, [fitViewWithoutSemanticZoom, scene, updateRequest]);

  const handleFitView = useCallback(() => {
    fitViewWithoutSemanticZoom();
  }, [fitViewWithoutSemanticZoom]);

  const handleRefocusSelected = useCallback(() => {
    const selectedNode = reactFlowInstance
      ?.getNodes()
      .find((node): node is Node<SceneFlowNodeData> => Boolean(node.selected));

    if (selectedNode) {
      reactFlowInstance?.setCenter(
        selectedNode.position.x +
          getNodeWidth(
            selectedNode.data.sceneNode,
            selectedNode.data.sceneBand
          ) /
            2,
        selectedNode.position.y +
          getNodeHeight(
            selectedNode.data.sceneNode,
            selectedNode.data.sceneBand
          ) /
            2,
        { zoom: reactFlowInstance.getZoom() }
      );

      return;
    }

    handleFitView();
  }, [handleFitView, reactFlowInstance]);

  const handleRearrange = useCallback(() => {
    layoutNodes(nodes, edges, scene?.band ?? request.band).then(
      (layoutedNodes) => {
        setNodes(layoutedNodes);
        setPendingFitNodeIds(layoutedNodes.map((node) => node.id));
      }
    );
  }, [edges, nodes, request.band, scene?.band]);

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
      if (isEditMode) {
        setActiveNode(undefined);
        setSelectedEdge(undefined);
        setSelectedNode(node.data.node as unknown as SourceType);

        return;
      }
      handleDrill(node.data.sceneNode);
    },
    [handleDrill, isEditMode, setActiveNode, setSelectedEdge, setSelectedNode]
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
      if (isEditMode && !isEditable) {
        showInfoToast(t('label.zoom-in'));

        return;
      }
      if (!isEditable) {
        onProviderEdgeClick(edge);

        return;
      }

      const fromNode = nodeById.get(getEndpointNodeId(sceneEdge.from));
      const toNode = nodeById.get(getEndpointNodeId(sceneEdge.to));
      const fromEntity = fromNode ? getRealEntityRef(fromNode) : undefined;
      const toEntity = toNode ? getRealEntityRef(toNode) : undefined;
      if (!fromEntity || !toEntity) {
        showInfoToast(t('message.no-lineage-data-available'));

        return;
      }

      try {
        const details = await getLineageEdgeDetails(fromEntity.id, toEntity.id);
        const hydratedEdge = hydrateSelectedEdge(
          edge,
          sceneEdge,
          nodeById,
          details
        );
        if (!hydratedEdge) {
          showInfoToast(t('message.no-lineage-data-available'));

          return;
        }
        setSelectedNode(undefined);
        setActiveNode(undefined);
        if (isEditMode) {
          setSelectedEdge(hydratedEdge);
        } else {
          onProviderEdgeClick(hydratedEdge);
        }
      } catch (error) {
        if ((error as AxiosError).response?.status === 404) {
          showInfoToast(t('message.no-lineage-data-available'));
          await refetchCurrentScene();

          return;
        }
        showErrorToast(error as AxiosError);
      }
    },
    [
      isEditMode,
      onProviderEdgeClick,
      refetchCurrentScene,
      scene,
      setActiveNode,
      setSelectedEdge,
      setSelectedNode,
      t,
    ]
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!isEditMode || scene?.band === LineageBand.Layer) {
        return;
      }
      const nodeById = new Map(
        nodesRef.current.map((node) => [node.id, node.data.sceneNode])
      );
      const sourceNode = connection.source
        ? nodeById.get(connection.source)
        : undefined;
      const targetNode = connection.target
        ? nodeById.get(connection.target)
        : undefined;
      if (
        !isEditableSceneNode(sourceNode) ||
        !isEditableSceneNode(targetNode)
      ) {
        showInfoToast(t('label.zoom-in'));

        return;
      }

      const fromEntity = getRealEntityRef(sourceNode);
      const toEntity = getRealEntityRef(targetNode);
      if (!fromEntity || !toEntity) {
        return;
      }

      setIsCreatingEdge(true);
      try {
        let existingDetails: LineageDetails | undefined;
        try {
          existingDetails = await getLineageEdgeDetails(
            fromEntity.id,
            toEntity.id
          );
        } catch (error) {
          if ((error as AxiosError).response?.status !== 404) {
            throw error;
          }
        }
        const payload = buildConnectPayload(
          connection,
          nodeById,
          existingDetails
        );
        if (!payload) {
          return;
        }
        await addLineageHandler(payload);
        setSelectedEdge(undefined);
        setSelectedNode(undefined);
        await refetchCurrentScene();
      } catch (error) {
        if ((error as AxiosError).response?.status !== undefined) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        setIsCreatingEdge(false);
      }
    },
    [
      isEditMode,
      refetchCurrentScene,
      scene?.band,
      setIsCreatingEdge,
      setSelectedEdge,
      setSelectedNode,
      t,
    ]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(undefined);
    setSelectedNode(undefined);
    setActiveNode(undefined);
    onProviderPaneClick();
  }, [onProviderPaneClick, setActiveNode, setSelectedEdge, setSelectedNode]);

  const handleNewNodeSelect = useCallback(
    (nodeId: string, value: EntityReference) => {
      const sourceEntity = value as EntityReference & Partial<SourceType>;
      const selectedEntityType = sourceEntity.entityType ?? value.type;
      const currentNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!currentNode || !selectedEntityType || !value.id) {
        return;
      }
      const selectedSceneNode: LineageSceneNode = {
        ...currentNode.data.sceneNode,
        entityType: selectedEntityType,
        fullyQualifiedName: value.fullyQualifiedName,
        label:
          value.displayName ?? value.name ?? value.fullyQualifiedName ?? '',
        sourceEntity: {
          ...sourceEntity,
          entityType: selectedEntityType,
          type: selectedEntityType,
        },
      };
      const selectedLineageNode = toLineageNode(selectedSceneNode, t);
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                connectable: true,
                data: {
                  ...node.data,
                  isNewNode: false,
                  isNodeRemovable: true,
                  label: undefined,
                  node: selectedLineageNode,
                  sceneNode: selectedSceneNode,
                },
              }
            : node
        )
      );
      setSelectedEdge(undefined);
      setSelectedNode(selectedLineageNode as unknown as SourceType);
    },
    [setSelectedEdge, setSelectedNode, t]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isEditMode || scene?.band === LineageBand.Layer) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [isEditMode, scene?.band]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (
        !isEditMode ||
        !scene ||
        scene?.band === LineageBand.Layer ||
        !reactFlowInstance ||
        !wrapperRef.current
      ) {
        return;
      }
      event.preventDefault();
      const droppedEntityType = event.dataTransfer.getData(
        'application/reactflow'
      );
      if (!droppedEntityType) {
        return;
      }
      const nodeId = `temporary:${uniqueId('lineage-map-node-')}`;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const temporarySceneNode: LineageSceneNode = {
        band: scene.band,
        entityType: droppedEntityType,
        id: nodeId,
        label: droppedEntityType,
        levelKind: LineageLevelKind.Asset,
        sourceEntity: {
          entityType: droppedEntityType,
          type: droppedEntityType,
        },
      };
      const temporaryLineageNode = toLineageNode(temporarySceneNode, t);
      const temporaryNode: Node<SceneFlowNodeData> = {
        connectable: false,
        data: {
          hasIncomers: false,
          hasOutgoers: false,
          isDownstreamNode: false,
          isNewNode: true,
          isNodeRemovable: true,
          isRootNode: false,
          isUpstreamNode: false,
          label: (
            <>
              <LineageNodeRemoveButton
                onRemove={() => removeSceneNode({ id: nodeId })}
              />
              <NodeSuggestions
                entityType={droppedEntityType}
                onSelectHandler={(value) => handleNewNodeSelect(nodeId, value)}
              />
            </>
          ),
          node: temporaryLineageNode,
          nodeWidth: NODE_WIDTH,
          onSceneDrill: handleDrill,
          onSceneNodeRemove: removeSceneNode,
          sceneBand: scene.band,
          sceneDrillLabel: t('label.zoom-in'),
          sceneNode: temporarySceneNode,
        },
        height: NODE_HEIGHT,
        id: nodeId,
        position,
        type: EntityLineageNodeType.DEFAULT,
        width: NODE_WIDTH,
      };
      setNodes((currentNodes) => [...currentNodes, temporaryNode]);
    },
    [
      handleDrill,
      handleNewNodeSelect,
      isEditMode,
      reactFlowInstance,
      removeSceneNode,
      scene?.band,
      t,
    ]
  );

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (
        !isEditMode ||
        !selectedNode ||
        (event.key !== 'Delete' && event.key !== 'Backspace')
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      const selectedFlowNode = nodesRef.current.find(
        (node) => node.data.node === selectedNode
      );
      if (selectedFlowNode) {
        event.preventDefault();
        removeSceneNode(selectedFlowNode);
      }
    };
    window.addEventListener('keydown', handleDeleteKey);

    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [isEditMode, removeSceneNode, selectedNode]);

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!reactFlowInstance || !wrapperRef.current) {
        return;
      }

      const target = event.target as HTMLElement;
      if (
        target.closest(
          '.react-flow__panel, .lineage-map-layer-control, .lineage-map-panel, .lineage-map-rail'
        )
      ) {
        pendingHoverPointRef.current = undefined;
        setHoveredNodeId(undefined);

        return;
      }
      pendingHoverPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      if (hoverFrameRef.current) {
        return;
      }
      hoverFrameRef.current = window.requestAnimationFrame(() => {
        hoverFrameRef.current = undefined;
        const pendingPoint = pendingHoverPointRef.current;
        const wrapper = wrapperRef.current;
        if (!pendingPoint || !wrapper) {
          return;
        }
        const rect = wrapper.getBoundingClientRect();
        const viewport = reactFlowInstance.getViewport();
        const point = {
          x: (pendingPoint.x - rect.left - viewport.x) / viewport.zoom,
          y: (pendingPoint.y - rect.top - viewport.y) / viewport.zoom,
        };
        const hoveredNode = nodesRef.current.find((node) => {
          const width = node.width ?? NODE_WIDTH;
          const height =
            node.height ??
            getNodeHeight(node.data.sceneNode, node.data.sceneBand);

          return (
            point.x >= node.position.x &&
            point.x <= node.position.x + width &&
            point.y >= node.position.y &&
            point.y <= node.position.y + height
          );
        });
        const nextHoveredNodeId = hoveredNode?.id;
        setHoveredNodeId((currentHoveredNodeId) =>
          currentHoveredNodeId === nextHoveredNodeId
            ? currentHoveredNodeId
            : nextHoveredNodeId
        );
      });
    },
    [reactFlowInstance]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    pendingHoverPointRef.current = undefined;
    if (hoverFrameRef.current) {
      window.cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = undefined;
    }
    setHoveredNodeId(undefined);
  }, []);

  if (loading && !scene) {
    return <LineageSkeleton />;
  }

  if (sceneError && !scene) {
    return (
      <div className="lineage-map-empty">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <span>{t('message.something-went-wrong')}</span>
          <Button
            data-testid="lineage-map-retry"
            onClick={() =>
              fetchScene(request, {
                bypassCache: true,
              })
            }>
            {t('label.try-again')}
          </Button>
        </ErrorPlaceHolder>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="lineage-map-empty">
        <span>{t('message.no-lineage-data-available')}</span>
      </div>
    );
  }

  if (scene.nodes.length === 0) {
    return (
      <div className="lineage-map-empty">
        <ErrorPlaceHolder
          placeholderText={t('message.no-lineage-data-available')}
          type={ERROR_PLACEHOLDER_TYPE.FILTER}
        />
      </div>
    );
  }

  const canDrillScene = scene.nodes.some(isSceneNodeDrillable);
  const visibleAssetCount = scene.nodes.length;
  const totalAssetCount = visibleAssetCount + (scene.hiddenNodeCount ?? 0);

  return (
    <div
      className="lineage-map-canvas"
      data-testid="lineage-map-canvas"
      ref={wrapperRef}
      onMouseLeave={handleCanvasMouseLeave}
      onMouseMove={handleCanvasMouseMove}>
      {loading && (
        <div className="lineage-map-loading">
          <Loader size="small" />
        </div>
      )}
      <ReactFlow
        fitView
        onlyRenderVisibleElements
        className="custom-react-flow lineage-map-react-flow"
        data-testid="react-flow-component"
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
        nodesConnectable={isEditMode && scene.band !== LineageBand.Layer}
        selectNodesOnDrag={false}
        onConnect={handleConnect}
        onConnectEnd={() => setIsCreatingEdge(false)}
        onConnectStart={() => setIsCreatingEdge(true)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onInit={setReactFlowInstance}
        onMove={handleMove}
        onNodeClick={handleNodeClick}
        onNodesChange={(changes) =>
          setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
        }
        onPaneClick={handlePaneClick}>
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
          onEdgeRemove={onColumnEdgeRemove}
          onPipelineClick={onAddPipelineClick}
        />
        <LineageMapControls
          canDrill={canDrillScene}
          isEditMode={isEditMode}
          scene={scene}
          onBandChange={handleBandChange}
        />
        <LineageMapBreadcrumbs
          isEditMode={isEditMode}
          scene={scene}
          onBreadcrumbFocus={handleBreadcrumbFocus}
        />
        {(scene.hiddenNodeCount ?? 0) > 0 || scene.sampled || sceneError ? (
          <Panel className="lineage-map-status-panel" position="top-right">
            {(scene.hiddenNodeCount ?? 0) > 0 && (
              <Badge color="gray" size="sm" type="color">
                {t('label.plus-count-more', {
                  count: scene.hiddenNodeCount,
                })}
              </Badge>
            )}
            {(scene.sampled || (scene.hiddenNodeCount ?? 0) > 0) && (
              <Alert
                title={
                  scene.sampled
                    ? t('message.showing-count-of-total-assets', {
                        count: visibleAssetCount,
                        total: totalAssetCount,
                      })
                    : t('message.knowledge-graph-truncated')
                }
                variant="warning"
              />
            )}
            {sceneError && (
              <Alert
                title={t('message.something-went-wrong')}
                variant="error"
              />
            )}
          </Panel>
        ) : null}
        <LineageMapOnboardingDialog
          open={showOnboarding}
          onClose={handleOnboardingClose}
        />
        <Panel position="bottom-right">
          <LineageControlButtons
            miniMapVisible={miniMapVisible}
            reactFlowInstance={reactFlowInstance}
            onFitView={handleFitView}
            onRearrange={handleRearrange}
            onRefocusHome={handleRecenterOrigin}
            onRefocusSelected={handleRefocusSelected}
            onToggleMiniMap={() => setMiniMapVisible((visible) => !visible)}
          />
        </Panel>
      </ReactFlow>
      <div
        className={classNames('lineage-map-layer-control', {
          'edit-mode': isEditMode,
        })}>
        <LineageLayers
          entity={entity}
          entityType={entityType}
          sceneBand={scene.band}
          sceneLens={scene.lens}
          sceneLevelLabelKey={getSceneLevelLabelKey(scene)}
          onSceneBandChange={handleBandChange}
          onSceneLensChange={handleLensChange}
        />
      </div>
    </div>
  );
};

const LineageMap = ({
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
        entity={entity}
        entityType={entityType}
        isPlatformLineage={isPlatformLineage}
      />
    </ReactFlowProvider>
  );
};

export default LineageMap;
