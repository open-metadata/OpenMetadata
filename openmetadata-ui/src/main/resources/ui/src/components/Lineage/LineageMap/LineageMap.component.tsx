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
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Home02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import type { LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import { debounce, isEqual } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  COLUMN_NODE_HEIGHT,
  LINEAGE_CHILD_ITEMS_PER_PAGE,
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  NODE_HEIGHT,
  NODE_HEIGHT_WITH_CHILDREN,
  NODE_WIDTH,
} from '../../../constants/Lineage.constants';
import { EntityLineageNodeType, EntityType } from '../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
  LineageScene,
  LineageSceneBreadcrumb,
  LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import {
  LineageSettings,
  PipelineViewMode,
} from '../../../generated/configuration/lineageSettings';
import { LineageLayer } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getLineageScene } from '../../../rest/lineageAPI';
import ELKLayout from '../../../utils/Lineage/Layout/ELKUtil/ELKUtil';
import { showErrorToast } from '../../../utils/ToastUtils';
import CustomNodeV1 from '../../Entity/EntityLineage/CustomNodeV1.component';
import { LineageConfig } from '../../Entity/EntityLineage/EntityLineage.interface';
import LineageControlButtons from '../../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../../Entity/EntityLineage/LineageLayers/LineageLayers';
import { EntityChildren } from '../../Entity/EntityLineage/NodeChildren/NodeChildren.interface';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { CanvasLayerWrapper } from '../Edges/CanvasLayerWrapper/CanvasLayerWrapper';
import { LineageNodeType, LineageProps } from '../Lineage.interface';
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

const FIELD_SEPARATOR = '::field::';
const LINEAGE_MAP_ONBOARDING_COOKIE = 'lineageMapsOnboardingSeen';
const ZOOM_IN_THRESHOLD = 1.9;
const ZOOM_OUT_THRESHOLD = 0.5;
const SEMANTIC_ZOOM_COOLDOWN = 450;
const PROGRAMMATIC_ZOOM_SUPPRESSION_MS = 1200;
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

const getEndpointNodeId = (endpoint: string) => {
  const index = endpoint.indexOf(FIELD_SEPARATOR);

  return index === -1 ? endpoint : endpoint.slice(0, index);
};

const getEndpointHandle = (endpoint: string) => {
  const index = endpoint.indexOf(FIELD_SEPARATOR);

  return index === -1
    ? undefined
    : endpoint.slice(index + FIELD_SEPARATOR.length);
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

const isSceneNodeDrillable = (node?: LineageSceneNode) =>
  Boolean(node?.isExpandable && node.fullyQualifiedName);

const getSceneCacheKey = (request: SceneRequest) =>
  [
    request.lens,
    request.band,
    request.focusFqn ?? '',
    request.entityType ?? '',
  ].join('|');

const toFlowEdge = (
  scene: LineageScene,
  edge: LineageScene['edges'][number]
): Edge => {
  const source = getEndpointNodeId(edge.from);
  const target = getEndpointNodeId(edge.to);
  const sourceHandle = getEndpointHandle(edge.from);
  const targetHandle = getEndpointHandle(edge.to);

  return {
    id: edge.id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'buttonedge',
    data: {
      edge: {
        fromEntity: {
          id: source,
          type:
            scene.nodes.find((node) => node.id === source)?.entityType ?? '',
          fullyQualifiedName: scene.nodes.find((node) => node.id === source)
            ?.fullyQualifiedName,
        },
        toEntity: {
          id: target,
          type:
            scene.nodes.find((node) => node.id === target)?.entityType ?? '',
          fullyQualifiedName: scene.nodes.find((node) => node.id === target)
            ?.fullyQualifiedName,
        },
        source: edge.source,
        sqlQuery: edge.sqlQuery,
      },
      isColumnLineage: Boolean(sourceHandle || targetHandle),
      label: edge.label,
      isRollup: edge.isRollup,
      weight: edge.weight,
    },
  };
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
    <Dialog
      fullWidth
      className="lineage-map-onboarding-dialog"
      data-testid="lineage-map-onboarding-dialog"
      maxWidth="sm"
      open={open}
      onClose={onClose}>
      <DialogContent className="lineage-map-onboarding-content">
        <Box className="lineage-map-onboarding-header">
          <Typography className="lineage-map-onboarding-eyebrow">
            {t('label.lineage-map-onboarding-eyebrow')}
          </Typography>
          <Typography className="lineage-map-onboarding-title">
            {t('label.lineage-map-onboarding-title')}
          </Typography>
          <Typography className="lineage-map-onboarding-description">
            {t('message.lineage-map-onboarding-description')}
          </Typography>
        </Box>
        <Box className="lineage-map-onboarding-body">
          <Box className="lineage-map-onboarding-row">
            <span
              aria-hidden="true"
              className="lineage-map-onboarding-icon altitude"
            />
            <Box>
              <Typography className="lineage-map-onboarding-row-title">
                {t('label.altitude')}
              </Typography>
              <Typography className="lineage-map-onboarding-row-description">
                {t('message.lineage-map-onboarding-altitude-description')}
              </Typography>
            </Box>
          </Box>
          <Box className="lineage-map-onboarding-row">
            <span
              aria-hidden="true"
              className="lineage-map-onboarding-icon layer"
            />
            <Box>
              <Typography className="lineage-map-onboarding-row-title">
                {t('label.layer')}
              </Typography>
              <Typography className="lineage-map-onboarding-row-description">
                {t('message.lineage-map-onboarding-layer-description')}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box className="lineage-map-onboarding-footer">
          <Typography className="lineage-map-onboarding-hint">
            {t('message.lineage-map-onboarding-hint')}
          </Typography>
          <Button
            className="lineage-map-onboarding-action"
            variant="contained"
            onClick={onClose}>
            {t('label.explore')}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

const LineageMapControls = ({
  scene,
  onBandChange,
}: {
  scene: LineageScene;
  onBandChange: (band: LineageBand) => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const bandOptions = [LineageBand.Layer, LineageBand.Asset, LineageBand.Field];

  return (
    <Box className="lineage-map-rail">
      {bandOptions.map((band) => (
        <Tooltip key={band} placement="left" title={t(getBandLabelKey(band))}>
          <IconButton
            className="lineage-map-rail-button"
            data-testid={`lineage-map-band-${band}`}
            sx={{
              color:
                scene.band === band
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary,
            }}
            onClick={(event) => {
              event.stopPropagation();
              onBandChange(band);
            }}>
            <span
              className={
                scene.band === band
                  ? 'lineage-map-rail-dot active'
                  : 'lineage-map-rail-dot'
              }
            />
          </IconButton>
        </Tooltip>
      ))}
      <Typography className="lineage-map-rail-label">
        {t(getSceneLevelLabelKey(scene))}
      </Typography>
    </Box>
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

  return (
    <Panel className="lineage-map-breadcrumb-panel" position="top-left">
      <Breadcrumbs
        aria-label={t('label.navigation')}
        className="lineage-map-breadcrumbs"
        data-testid="lineage-map-breadcrumbs"
        separator={<span className="lineage-map-breadcrumb-separator" />}>
        {scene.breadcrumb.map((breadcrumb, index) => {
          const isRootBreadcrumb = !breadcrumb.fullyQualifiedName;
          const label = isRootBreadcrumb
            ? t(getLensRootLabelKey(scene.lens))
            : breadcrumb.label;
          const isCurrent = isRootBreadcrumb
            ? scene.band === LineageBand.Layer && !scene.focusFqn
            : breadcrumb.fullyQualifiedName === scene.focusFqn;

          return (
            <button
              className={classNames('lineage-map-breadcrumb-item', {
                active: isCurrent,
              })}
              data-testid={`lineage-map-breadcrumb-${index}`}
              disabled={isCurrent}
              key={breadcrumb.id}
              title={label}
              type="button"
              onClick={() => onBreadcrumbFocus(breadcrumb)}>
              {isRootBreadcrumb && <Home02 size={14} />}
              <span>{label}</span>
            </button>
          );
        })}
      </Breadcrumbs>
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
  const lastSemanticZoomAtRef = useRef(0);
  const previousZoomRef = useRef<number>();
  const semanticZoomSuppressedRef = useRef(false);
  const semanticZoomSuppressedUntilRef = useRef(0);
  const semanticZoomResumeTimerRef = useRef<number>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    isEditMode,
    selectedColumn,
    setActiveLayer,
    setColumnsHavingLineage,
    setColumnsInCurrentPages,
    setIsPlatformLineage,
    setSelectedColumn,
    setTracedColumns,
  } = useLineageStore();

  useEffect(() => {
    setActiveLayer(getActiveLayersFromBand(request.band));
    setIsPlatformLineage(Boolean(isPlatformLineage));
  }, [isPlatformLineage, request.band, setActiveLayer, setIsPlatformLineage]);

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
      setRequest((current) =>
        isEqual(current, nextRequest) ? current : nextRequest
      );
    },
    [suppressSemanticZoom]
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
    async (nextRequest: SceneRequest) => {
      const cacheKey = getSceneCacheKey(nextRequest);
      const cachedScene = cacheRef.current.get(cacheKey);
      if (cachedScene) {
        setScene(cachedScene);

        return;
      }
      setLoading(true);
      try {
        const response = await getLineageScene({
          ...nextRequest,
          config,
        });
        cacheRef.current.set(cacheKey, response);
        setScene(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [config]
  );

  const prefetchAdjacentBands = useMemo(
    () =>
      debounce((currentScene: LineageScene) => {
        const bands =
          currentScene.band === LineageBand.Asset
            ? [LineageBand.Layer, LineageBand.Field]
            : [LineageBand.Asset];
        bands.forEach((band) => {
          const nextRequest = { ...request, band };
          const cacheKey = getSceneCacheKey(nextRequest);
          if (!cacheRef.current.has(cacheKey)) {
            getLineageScene({ ...nextRequest, config })
              .then((response) => cacheRef.current.set(cacheKey, response))
              .catch(() => undefined);
          }
        });
      }, 300),
    [config, request]
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
    const nextEdges = scene.edges.map((edge) => toFlowEdge(scene, edge));
    setColumnsHavingLineage(getColumnsHavingLineage(scene.edges));
    setColumnsInCurrentPages(new Map());

    const nextNodes: Node<SceneFlowNodeData>[] = scene.nodes.map((node) => {
      const lineageNode = toLineageNode(node, t);

      return {
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
        setPendingFitNodeIds(layoutedNodes.map((node) => node.id));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    handleDrill,
    handleSceneColumnHover,
    handleSceneColumnSelect,
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
      .find((node): node is Node<SceneFlowNodeData> => node.selected);

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
    () => buildLineagePathHighlightIndex(edges),
    [edges]
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
          data: {
            ...node.data,
            isPathHighlighted,
          },
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
        setHoveredNodeId(undefined);

        return;
      }

      const rect = wrapperRef.current.getBoundingClientRect();
      const viewport = reactFlowInstance.getViewport();
      const point = {
        x: (event.clientX - rect.left - viewport.x) / viewport.zoom,
        y: (event.clientY - rect.top - viewport.y) / viewport.zoom,
      };
      const hoveredNode = nodes.find((node) => {
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
    },
    [nodes, reactFlowInstance]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredNodeId(undefined);
  }, []);

  if (loading && !scene) {
    return <LineageSkeleton />;
  }

  if (!scene) {
    return (
      <Box className="lineage-map-empty">
        <Typography>{t('message.no-lineage-data-available')}</Typography>
      </Box>
    );
  }

  return (
    <Box
      className="lineage-map-canvas"
      data-testid="lineage-map-canvas"
      ref={wrapperRef}
      onMouseLeave={handleCanvasMouseLeave}
      onMouseMove={handleCanvasMouseMove}>
      {loading && (
        <Box className="lineage-map-loading">
          <CircularProgress size={24} />
        </Box>
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
        nodesConnectable={false}
        selectNodesOnDrag={false}
        onInit={setReactFlowInstance}
        onMove={handleMove}
        onNodeClick={handleNodeClick}
        onNodesChange={(changes) =>
          setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
        }>
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
          onEdgeHover={setHoveredEdge}
        />
        <LineageMapControls scene={scene} onBandChange={handleBandChange} />
        <LineageMapBreadcrumbs
          scene={scene}
          onBreadcrumbFocus={handleBreadcrumbFocus}
        />
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
      <Box
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
      </Box>
    </Box>
  );
};

const LineageMap = ({
  entity,
  entityType,
  isPlatformLineage,
}: LineageProps) => {
  const { appPreferences } = useApplicationStore();
  const defaultLineageConfig = appPreferences?.lineageConfig as
    | LineageSettings
    | undefined;
  const config = useMemo<LineageConfig>(
    () => ({
      upstreamDepth: defaultLineageConfig?.upstreamDepth ?? 1,
      downstreamDepth: defaultLineageConfig?.downstreamDepth ?? 1,
      nodesPerLayer: 200,
      pipelineViewMode:
        defaultLineageConfig?.pipelineViewMode ?? PipelineViewMode.Node,
    }),
    [defaultLineageConfig]
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
