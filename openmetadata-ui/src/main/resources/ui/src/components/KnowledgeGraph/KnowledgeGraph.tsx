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
  EdgeData as G6EdgeData,
  ExtensionCategory,
  Graph,
  NodeData as G6NodeData,
  register,
} from '@antv/g6';
import { ReactNode as AntVReactNode } from '@antv/g6-extension-react';
import { Card, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { toPng } from 'html-to-image';
import { isArray } from 'lodash';
import Qs from 'qs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Key, Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as LineageIcon } from '../../assets/svg/ic-platform-lineage.svg';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { downloadEntityGraph, getEntityGraphData } from '../../rest/rdfAPI';
import { EntityGraphExportFormat } from '../../rest/rdfAPI.interface';
import { getEntityBreadcrumbs } from '../../utils/EntityBreadcrumbPureUtils';
import {
  applyGraphLayout,
  applyInitialFocus,
  countRelationCategories,
  getFullscreenClassNames,
  getNodeRenderKey,
  hasActiveGraphFilters,
  isGraphEmpty,
  resolveFocusNodeId,
  setupGraphEventHandlers,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';

import { ExportFormat } from '../OntologyExplorer/ExportGraphPanel.interface';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import CustomNode from './GraphElements/CustomNode';
import {
  EXPORT_FORMAT_MAP,
  FIT_SCALE_FACTOR,
  ZOOM_DURATION_MS,
  ZOOM_EASING,
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from './KnowledgeGraph.constants';
import {
  EdgeTooltipState,
  GraphData,
  GraphNode,
  KnowledgeGraphLayout,
  KnowledgeGraphProps,
} from './KnowledgeGraph.interface';
import './KnowledgeGraph.style.less';
import KnowledgeGraphLegend from './KnowledgeGraphLegend';
import KnowledgeGraphOverlays from './KnowledgeGraphOverlays';
import KnowledgeGraphToolbar from './KnowledgeGraphToolbar';
import KnowledgeGraphViewControls from './KnowledgeGraphViewControls';

register(ExtensionCategory.NODE, 'react-node', AntVReactNode);

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  entity,
  entityType,
  depth = 1,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Graph | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const pendingHighlightRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [graphReady, setGraphReady] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(depth);
  // Radial is the default because the tab opens at depth 1, where the graph is
  // always a star around the focus entity. A layered layout stacks all of those
  // neighbours into one column and funnels every edge through a single point,
  // which is unreadable; radial gives each relationship its own spoke.
  // Hierarchical stays one click away for the directional depth of lineage.
  const [layout, setLayout] = useState<KnowledgeGraphLayout>('radial');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<EdgeTooltipState | null>(null);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  const [selectedRelationshipTypes, setSelectedRelationshipTypes] = useState<
    string[]
  >([]);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [relationshipDropdownOpen, setRelationshipDropdownOpen] =
    useState(false);
  const [entityFilterText, setEntityFilterText] = useState('');
  const [relationshipFilterText, setRelationshipFilterText] = useState('');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { preferences } = useCurrentUserPreferences();

  const isFullscreen = useMemo(() => {
    const params = Qs.parse(location.search, { ignoreQueryPrefix: true });

    return params[FULLSCREEN_QUERY_PARAM_KEY] === 'true';
  }, [location.search]);

  const breadcrumbs = useMemo(
    () =>
      entity?.fullyQualifiedName
        ? [
            ...getEntityBreadcrumbs(
              entity as SearchedDataProps['data'][number]['_source'],
              entityType as EntityType,
              isFullscreen
            ),
            {
              name: t('label.knowledge-graph'),
              url: '',
              activeTitle: true,
            },
          ]
        : [],
    [entity?.fullyQualifiedName, entityType, t, isFullscreen]
  );

  const nodeLabelById = useMemo(
    () => new Map(graphData?.nodes.map((n) => [n.id, n.label]) ?? []),
    [graphData]
  );

  const legendCounts = useMemo(
    () => countRelationCategories(graphData),
    [graphData]
  );

  /**
   * Rendering failed, so the canvas will stay blank. Clear the loading overlay
   * as well as toasting — a spinner that never resolves reads as a hang rather
   * than as an error.
   */
  const reportGraphFailure = useCallback(
    (error: unknown) => {
      showErrorToast(error as AxiosError, t('server.unexpected-error'));
      setGraphReady(true);
    },
    [t]
  );

  const fetchGraphData = useCallback(async () => {
    if (!entity?.id) {
      return;
    }
    setLoading(true);
    try {
      const data = await getEntityGraphData({
        entityId: entity.id,
        entityType,
        depth: selectedDepth,
        entityTypes: selectedEntityTypes,
        relationshipTypes: selectedRelationshipTypes,
      });
      setGraphData(data);
    } catch (error) {
      // Without this the rejection is unhandled and `graphData` stays null, so
      // the empty state claims the RDF indexing app is misconfigured — pointing
      // the user at the wrong cause for what is really a failed request. Any
      // previously loaded graph is left on screen rather than blanked.
      showErrorToast(error as AxiosError, t('server.unexpected-error'));
    } finally {
      setLoading(false);
    }
  }, [
    entity?.id,
    entityType,
    selectedDepth,
    selectedEntityTypes,
    selectedRelationshipTypes,
    t,
  ]);

  const renderNode = useCallback(
    (data: G6NodeData) => (
      <CustomNode nodeData={data} nodeRenderKey={getNodeRenderKey(data)} />
    ),
    []
  );

  const handleZoom = useCallback((factor: number) => {
    if (!networkRef.current) {
      return;
    }
    const currentZoom = networkRef.current.getZoom();
    void networkRef.current.zoomTo(currentZoom * factor, {
      duration: ZOOM_DURATION_MS,
      easing: ZOOM_EASING,
    });
  }, []);

  const handleZoomIn = useCallback(
    () => handleZoom(ZOOM_IN_FACTOR),
    [handleZoom]
  );

  const handleZoomOut = useCallback(
    () => handleZoom(ZOOM_OUT_FACTOR),
    [handleZoom]
  );

  const handleFit = useCallback(() => {
    if (!networkRef.current) {
      return;
    }
    networkRef.current
      .fitView()
      .then(() => {
        const currentZoom = networkRef.current?.getZoom() ?? 1;
        networkRef.current?.zoomTo(currentZoom * FIT_SCALE_FACTOR);
      })
      // A fit that cannot run leaves the graph exactly as it was, which is a
      // usable state — not worth interrupting the user, but it must not be an
      // unhandled rejection either.
      .catch(() => undefined);
  }, []);

  const handleFullscreen = useCallback(() => {
    navigate({
      search: isFullscreen
        ? ''
        : Qs.stringify({ [FULLSCREEN_QUERY_PARAM_KEY]: true }),
    });
  }, [isFullscreen, navigate]);

  const handleExportPng = useCallback(async () => {
    if (!containerRef.current) {
      return;
    }
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'knowledge-graph.png';
      a.click();
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  }, [t]);

  const handleExport = useCallback(
    async (format: EntityGraphExportFormat) => {
      if (!entity?.id || !entityType) {
        showErrorToast(
          t('label.no-entity-selected', { entity: t('label.asset') })
        );

        return;
      }
      try {
        await downloadEntityGraph({
          entityId: entity.id,
          entityType,
          entityName:
            entity.fullyQualifiedName ?? entity.name ?? 'knowledge-graph',
          depth: selectedDepth,
          entityTypes: selectedEntityTypes.length
            ? selectedEntityTypes
            : undefined,
          relationshipTypes: selectedRelationshipTypes.length
            ? selectedRelationshipTypes
            : undefined,
          format,
        });
      } catch {
        showErrorToast(t('server.unexpected-error'));
      }
    },
    [
      entity?.id,
      entity?.fullyQualifiedName,
      entity?.name,
      entityType,
      selectedDepth,
      selectedEntityTypes,
      selectedRelationshipTypes,
      t,
    ]
  );

  const handleExportJsonLd = useCallback(
    () =>
      handleExport(
        EXPORT_FORMAT_MAP[ExportFormat.JSONLD] as EntityGraphExportFormat
      ),
    [handleExport]
  );

  const handleExportTurtle = useCallback(
    () =>
      handleExport(
        EXPORT_FORMAT_MAP[ExportFormat.TURTLE] as EntityGraphExportFormat
      ),
    [handleExport]
  );

  const handleEntityDropdownChange = useCallback((open: boolean) => {
    setEntityDropdownOpen(open);
    if (!open) {
      setEntityFilterText('');
    }
  }, []);

  const handleRelationshipDropdownChange = useCallback((open: boolean) => {
    setRelationshipDropdownOpen(open);
    if (!open) {
      setRelationshipFilterText('');
    }
  }, []);

  const handleLayoutChange = useCallback((key: Key) => {
    setLayout(key as KnowledgeGraphLayout);
  }, []);

  const handleSlideoutClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setSelectedNode(null);
    }
  }, []);

  const handleEntityFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEntityFilterText(e.target.value);
    },
    []
  );

  const handleRelationshipFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRelationshipFilterText(e.target.value);
    },
    []
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleRefresh = useCallback(() => {
    void fetchGraphData();
  }, [fetchGraphData]);

  const handleDepthChange = useCallback((value: number | number[]) => {
    setSelectedDepth(isArray(value) ? value[0] : value);
  }, []);

  const handleToggleLegend = useCallback(
    () => setIsLegendCollapsed((collapsed) => !collapsed),
    []
  );

  const handleShowEdgeLabelsChange = useCallback(
    (isSelected: boolean) => setShowEdgeLabels(isSelected),
    []
  );

  useEffect(() => {
    if (!containerRef.current || !graphData || loading) {
      return;
    }

    let cancelled = false;
    let graph: Graph | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let removeWheelListener: (() => void) | null = null;

    const initGraph = async () => {
      if (!containerRef.current) {
        return;
      }

      const width = containerRef.current.offsetWidth || 800;
      const height = containerRef.current.offsetHeight || 600;
      const transformed = transformToG6Format(graphData, { showEdgeLabels });
      const focusNodeId = resolveFocusNodeId(
        transformed.nodes ?? [],
        entity?.id
      );
      const g6Data = await applyGraphLayout(transformed, {
        layout,
        focusNodeId,
        width,
        height,
        hasEntity: Boolean(entity?.id),
      });

      if (cancelled) {
        return;
      }

      graph = new Graph({
        container: containerRef.current,
        width,
        height,
        animation: false,
        data: g6Data,
        layout: { type: 'preset' },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        node: {
          type: 'react-node',
          style: {
            component: renderNode,
          },
        },
        edge: {
          type: (datum: G6EdgeData) =>
            String(
              datum.type ??
                (layout === 'radial' ? 'quadratic' : 'cubic-horizontal')
            ),
          style: {
            endArrow: true,
            labelBackgroundPadding: [3, 6],
          },
        },
      });

      networkRef.current = graph;

      graph
        .render()
        .then(async () => {
          if (cancelled) {
            return;
          }
          if (graph) {
            await applyInitialFocus(graph, focusNodeId);
          }
          if (!cancelled) {
            setGraphReady(true);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            reportGraphFailure(error);
          }
        });

      setupGraphEventHandlers({
        graph,
        g6Nodes: g6Data.nodes ?? [],
        g6Edges: g6Data.edges ?? [],
        focusNodeId,
        graphDataNodes: graphData.nodes,
        showEdgeLabels,
        pendingHighlightRef,
        selectedNodeIdRef,
        setSelectedNode,
        setEdgeTooltip,
        canvasRef: containerRef,
      });

      resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && networkRef.current) {
          networkRef.current.resize(
            containerRef.current.offsetWidth,
            containerRef.current.offsetHeight
          );
        }
      });
      resizeObserver.observe(containerRef.current);

      // Wheel events on react-node DOM overlays don't reach G6's <canvas> element
      // (overlay divs and the canvas are siblings, not parent-child). Intercept at
      // the container level and re-emit into G6's own event system so zoom-canvas
      // handles zoom ratio, origin, and clamping exactly as for native canvas events.
      const wheelContainer = containerRef.current;
      const handleWheelOnOverlay = (e: WheelEvent) => {
        if (!graph) {
          return;
        }
        const nativeCanvas =
          wheelContainer.querySelector('canvas') ??
          wheelContainer.querySelector('svg');
        if (!nativeCanvas) {
          return;
        }
        if (
          nativeCanvas === e.target ||
          nativeCanvas.contains(e.target as Node)
        ) {
          return;
        }
        e.preventDefault();
        const rect = wheelContainer.getBoundingClientRect();
        graph.emit('wheel', {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          viewport: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        });
      };
      wheelContainer.addEventListener('wheel', handleWheelOnOverlay, {
        passive: false,
      });
      removeWheelListener = () =>
        wheelContainer.removeEventListener('wheel', handleWheelOnOverlay);
    };

    initGraph().catch(reportGraphFailure);

    return () => {
      cancelled = true;
      setGraphReady(false);
      if (networkRef.current === graph) {
        networkRef.current = null;
      }
      removeWheelListener?.();
      graph?.destroy();
      resizeObserver?.disconnect();
    };
  }, [graphData, loading, layout, entity?.id, isFullscreen, showEdgeLabels]);

  useEffect(() => {
    if (entity?.id) {
      fetchGraphData();
    }
  }, [fetchGraphData]);

  const hasNoData = isGraphEmpty(graphData);

  const entityTypeOptions = useMemo(
    () =>
      graphData?.filterOptions?.entityTypes.map((option) => ({
        id: option.id,
        label: `${option.label} (${option.count})`,
      })) ?? [],
    [graphData?.filterOptions]
  );

  const relationshipTypeOptions = useMemo(
    () =>
      graphData?.filterOptions?.relationshipTypes.map((option) => ({
        id: option.id,
        label: `${option.label} (${option.count})`,
      })) ?? [],
    [graphData?.filterOptions]
  );

  const filteredEntityTypeOptions = useMemo(
    () =>
      entityTypeOptions.filter((o) =>
        o.label.toLowerCase().includes(entityFilterText.toLowerCase())
      ),
    [entityTypeOptions, entityFilterText]
  );

  const filteredRelationshipTypeOptions = useMemo(
    () =>
      relationshipTypeOptions.filter((o) =>
        o.label.toLowerCase().includes(relationshipFilterText.toLowerCase())
      ),
    [relationshipTypeOptions, relationshipFilterText]
  );

  const handleEntityTypeSelectionChange = useCallback(
    (keys: Selection) => {
      setSelectedEntityTypes(
        keys === 'all'
          ? entityTypeOptions.map((o) => o.id)
          : Array.from(keys as Set<string>)
      );
    },
    [entityTypeOptions]
  );

  const handleRelationshipTypeSelectionChange = useCallback(
    (keys: Selection) => {
      setSelectedRelationshipTypes(
        keys === 'all'
          ? relationshipTypeOptions.map((o) => o.id)
          : Array.from(keys as Set<string>)
      );
    },
    [relationshipTypeOptions]
  );

  const hasActiveFilters = hasActiveGraphFilters({
    layout,
    selectedEntityTypes,
    selectedRelationshipTypes,
    selectedDepth,
    defaultDepth: depth,
  });

  const handleClearAll = useCallback(() => {
    setLayout('radial');
    setSelectedEntityTypes([]);
    setSelectedRelationshipTypes([]);
    setSelectedDepth(depth);
  }, [depth]);

  const graphCanvas = (
    <>
      <div
        className="knowledge-graph-canvas"
        data-testid="knowledge-graph-canvas"
        ref={containerRef}>
        {!graphReady && (
          <div
            className="knowledge-graph-loading"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
            }}>
            <div className="tw:flex tw:items-center tw:justify-center">
              <Loader />
            </div>
          </div>
        )}
      </div>

      <KnowledgeGraphLegend
        counts={legendCounts}
        isCollapsed={isLegendCollapsed}
        onToggleCollapsed={handleToggleLegend}
      />

      <KnowledgeGraphOverlays
        edgeTooltip={edgeTooltip}
        edges={graphData?.edges ?? []}
        nodeLabelById={nodeLabelById}
        selectedNode={selectedNode}
        onClosePanel={handleClosePanel}
        onSlideoutOpenChange={handleSlideoutClose}
      />
    </>
  );

  const knowledgeGraph = loading ? (
    <div className="knowledge-graph-loading">
      <div className="tw:flex tw:items-center tw:justify-center">
        <Loader />
      </div>
    </div>
  ) : (
    graphCanvas
  );

  if (hasNoData && !loading) {
    return (
      <Card className="knowledge-graph-empty">
        <ErrorPlaceHolder
          className="tw:text-disabled"
          icon={<LineageIcon height={SIZE.MEDIUM} width={SIZE.MEDIUM} />}
          size={SIZE.X_SMALL}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          {t('message.no-knowledge-graph-data')}
        </ErrorPlaceHolder>
      </Card>
    );
  }

  if (!entity) {
    return (
      <div className="tw:flex tw:items-center tw:justify-center tw:h-full">
        <Typography className="tw:text-tertiary">
          {t('label.no-entity-selected', { entity: t('label.asset') })}
        </Typography>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        getFullscreenClassNames(isFullscreen, preferences?.isSidebarCollapsed)
      )}>
      {isFullscreen && breadcrumbs.length > 0 && (
        <TitleBreadcrumb
          useCustomArrow
          className="p-b-sm"
          titleLinks={breadcrumbs}
        />
      )}
      <Card
        className="knowledge-graph-container"
        data-testid="knowledge-graph-container">
        <Card.Header
          className="tw:block"
          extra={
            <KnowledgeGraphToolbar
              entityDropdownOpen={entityDropdownOpen}
              entityFilterText={entityFilterText}
              entityTypeOptions={entityTypeOptions}
              filteredEntityTypeOptions={filteredEntityTypeOptions}
              filteredRelationshipTypeOptions={filteredRelationshipTypeOptions}
              hasActiveFilters={hasActiveFilters}
              layout={layout}
              relationshipDropdownOpen={relationshipDropdownOpen}
              relationshipFilterText={relationshipFilterText}
              relationshipTypeOptions={relationshipTypeOptions}
              selectedDepth={selectedDepth}
              selectedEntityTypes={selectedEntityTypes}
              selectedRelationshipTypes={selectedRelationshipTypes}
              showEdgeLabels={showEdgeLabels}
              onClearAll={handleClearAll}
              onDepthChange={handleDepthChange}
              onEntityDropdownChange={handleEntityDropdownChange}
              onEntityFilterChange={handleEntityFilterChange}
              onEntityTypeSelectionChange={handleEntityTypeSelectionChange}
              onExportJsonLd={handleExportJsonLd}
              onExportPng={handleExportPng}
              onExportTurtle={handleExportTurtle}
              onLayoutChange={handleLayoutChange}
              onRelationshipDropdownChange={handleRelationshipDropdownChange}
              onRelationshipFilterChange={handleRelationshipFilterChange}
              onRelationshipTypeSelectionChange={
                handleRelationshipTypeSelectionChange
              }
              onShowEdgeLabelsChange={handleShowEdgeLabelsChange}
            />
          }
        />

        <Card.Content className="tw:p-0">
          {knowledgeGraph}

          <KnowledgeGraphViewControls
            isFullscreen={isFullscreen}
            onFit={handleFit}
            onFullscreen={handleFullscreen}
            onRefresh={handleRefresh}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        </Card.Content>
      </Card>
    </div>
  );
};

export default KnowledgeGraph;
