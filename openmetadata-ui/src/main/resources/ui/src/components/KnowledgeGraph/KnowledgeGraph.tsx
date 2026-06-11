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
  NodePortStyleProps,
  register,
} from '@antv/g6';
import { ReactNode as AntVReactNode } from '@antv/g6-extension-react';
import {
  Box,
  Button,
  Card,
  Divider,
  Dropdown,
  SlideoutMenu,
  Slider,
  Tabs,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
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
import { ReactComponent as ExitFullScreenIcon } from '../../assets/svg/ic-exit-fullscreen.svg';
import { ReactComponent as FitScreenIcon } from '../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as FullscreenIcon } from '../../assets/svg/ic-fullscreen.svg';
import { ReactComponent as LineageIcon } from '../../assets/svg/ic-platform-lineage.svg';
import { ReactComponent as ZoomInIcon } from '../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../assets/svg/ic-zoom-out.svg';
import { ReactComponent as RefreshIcon } from '../../assets/svg/reload.svg';
import {
  FULLSCREEN_QUERY_PARAM_KEY,
  LITE_GRAY_COLOR,
  WHITE_COLOR,
} from '../../constants/constants';
import { useTheme } from '../../context/UntitledUIThemeProvider/theme-provider';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { downloadEntityGraph, getEntityGraphData } from '../../rest/rdfAPI';
import { EntityGraphExportFormat } from '../../rest/rdfAPI.interface';
import { getEntityBreadcrumbs } from '../../utils/EntityBreadcrumbPureUtils';
import {
  applyInitialFocus,
  assignRadialPorts,
  computeELKPositions,
  computeELKRadialPositions,
  getNodeRenderKey,
  setupGraphEventHandlers,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntitySummaryPanel from '../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { SearchSourceDetails } from '../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';

import ExportGraphPanel from '../OntologyExplorer/ExportGraphPanel';
import { ExportFormat } from '../OntologyExplorer/ExportGraphPanel.interface';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import CustomNode from './GraphElements/CustomNode';
import {
  ENTITY_UUID_REGEX,
  EXPORT_FORMAT_MAP,
  FIT_SCALE_FACTOR,
  MAX_NODE_WIDTH,
  NODE_HEIGHT,
  PANEL_WIDTH,
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

register(ExtensionCategory.NODE, 'react-node', AntVReactNode);

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  entity,
  entityType,
  depth = 1,
}) => {
  const { t } = useTranslation();
  const { brandColors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Graph | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const pendingHighlightRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [graphReady, setGraphReady] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(depth);
  const [layout, setLayout] = useState<KnowledgeGraphLayout>('dagre');
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
    void networkRef.current.fitView().then(() => {
      const currentZoom = networkRef.current?.getZoom() ?? 1;
      networkRef.current?.zoomTo(currentZoom * FIT_SCALE_FACTOR);
    });
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

  const stopKeydownPropagation = useCallback(
    (e: React.KeyboardEvent) => e.stopPropagation(),
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

      const g6Data = transformToG6Format(graphData);
      const width = containerRef.current.offsetWidth || 800;
      const height = containerRef.current.offsetHeight || 600;

      const focusNodeId = entity?.id
        ? (g6Data.nodes ?? []).find(
            // Server may prefix IDs (e.g. "table::<uuid>"); suffix-match the raw UUID to cover both forms.
            (n) => n.id === entity.id || n.id.endsWith(entity.id)
          )?.id ?? entity.id
        : '';

      if (focusNodeId) {
        g6Data.nodes = (g6Data.nodes ?? []).map((node) =>
          node.id === focusNodeId
            ? {
                ...node,
                style: {
                  ...node.style,
                  size: [MAX_NODE_WIDTH, NODE_HEIGHT] as [number, number],
                },
              }
            : node
        );
      }

      if (layout === 'radial' && entity?.id) {
        const positions = await computeELKRadialPositions(
          g6Data.nodes ?? [],
          g6Data.edges ?? [],
          focusNodeId,
          width / 2,
          height / 2
        );
        if (cancelled) {
          return;
        }
        g6Data.nodes = (g6Data.nodes ?? []).map((node) => {
          const pos = positions.get(node.id);

          return pos
            ? { ...node, style: { ...node.style, x: pos.x, y: pos.y } }
            : node;
        });
        g6Data.edges = (g6Data.edges ?? []).map((edge) => ({
          ...edge,
          style: { ...edge.style, curveOffset: 50 },
        }));
      } else if (layout === 'dagre') {
        const positions = await computeELKPositions(
          g6Data.nodes ?? [],
          g6Data.edges ?? [],
          focusNodeId
        );
        if (cancelled) {
          return;
        }
        g6Data.nodes = (g6Data.nodes ?? []).map((node) => {
          const pos = positions.get(node.id);

          return pos
            ? { ...node, style: { ...node.style, x: pos.x, y: pos.y } }
            : node;
        });
      }

      const dagrePorts: NodePortStyleProps[] = [
        { key: 'left', placement: 'left', linkToCenter: false },
        { key: 'right', placement: 'right', linkToCenter: false },
      ];

      const radialLeftPort = {
        key: 'left',
        placement: [-0.04, 0.5] as [number, number],
        r: 6,
        fill: WHITE_COLOR,
        stroke: LITE_GRAY_COLOR,
        lineWidth: 1.5,
      };

      const radialRightPort = {
        key: 'right',
        placement: [1.04, 0.5] as [number, number],
        r: 6,
        fill: WHITE_COLOR,
        stroke: LITE_GRAY_COLOR,
        lineWidth: 1.5,
      };

      if (layout === 'radial') {
        g6Data.nodes = assignRadialPorts(
          g6Data.nodes ?? [],
          g6Data.edges ?? [],
          focusNodeId,
          width / 2,
          radialLeftPort,
          radialRightPort
        );
      } else {
        g6Data.nodes = (g6Data.nodes ?? []).map((node) => ({
          ...node,
          style: { ...node.style, ports: dagrePorts },
        }));
      }

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

      void graph.render().then(async () => {
        if (cancelled) {
          return;
        }
        if (graph) {
          await applyInitialFocus(graph, focusNodeId);
        }
        if (!cancelled) {
          setGraphReady(true);
        }
      });

      setupGraphEventHandlers({
        graph,
        g6Nodes: g6Data.nodes ?? [],
        g6Edges: g6Data.edges ?? [],
        focusNodeId,
        graphDataNodes: graphData.nodes,
        brandColors,
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

    void initGraph();

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
  }, [graphData, loading, layout, entity?.id, isFullscreen]);

  useEffect(() => {
    if (entity?.id) {
      fetchGraphData();
    }
  }, [fetchGraphData]);

  const hasNoData = !graphData || graphData.nodes.length === 0;

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

  const hasActiveFilters =
    layout !== 'dagre' ||
    selectedEntityTypes.length > 0 ||
    selectedRelationshipTypes.length > 0 ||
    selectedDepth !== depth;

  const handleClearAll = useCallback(() => {
    setLayout('dagre');
    setSelectedEntityTypes([]);
    setSelectedRelationshipTypes([]);
    setSelectedDepth(depth);
  }, [depth]);

  const filterInputClassName =
    'tw:w-full tw:rounded-md tw:bg-primary tw:px-2.5 tw:py-1.5 tw:text-sm' +
    ' tw:text-primary tw:placeholder:text-placeholder tw:outline-none' +
    ' tw:ring-1 tw:ring-border-primary tw:focus:ring-2 tw:focus:ring-brand';

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

      <div
        aria-hidden="true"
        className="tw:hidden"
        data-testid="knowledge-graph-edges">
        {graphData?.edges.map((edge) => (
          <div
            data-edge-label={edge.label}
            data-edge-source={edge.from}
            data-edge-target={edge.to}
            data-testid={`edge-${nodeLabelById.get(edge.from) ?? edge.from}-${
              edge.label
            }-${nodeLabelById.get(edge.to) ?? edge.to}`}
            key={`${edge.from}-${edge.label}-${edge.to}`}
          />
        ))}
      </div>

      {edgeTooltip && (
        <div
          aria-hidden="true"
          className="kg-edge-tooltip"
          data-testid="edge-tooltip"
          style={{
            left: edgeTooltip.x + 12,
            position: 'fixed',
            top: edgeTooltip.y + 12,
          }}>
          <div className="kg-edge-tooltip__direction">
            {`${edgeTooltip.sourceLabel} ${t('label.arrow-symbol')} ${
              edgeTooltip.targetLabel
            }`}
          </div>
          {edgeTooltip.labels.map((label) => (
            <div
              className="kg-edge-tooltip__label"
              key={`${edgeTooltip.edgeId}-${label}`}>
              {label}
            </div>
          ))}
        </div>
      )}

      {selectedNode?.fullyQualifiedName && (
        <SlideoutMenu
          isDismissable
          isOpen
          className="tw:z-1100"
          dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0"
          width={PANEL_WIDTH}
          onOpenChange={handleSlideoutClose}>
          {({ close }) => (
            <EntitySummaryPanel
              isSideDrawer
              entityDetails={{
                details: {
                  id:
                    ENTITY_UUID_REGEX.exec(selectedNode.id)?.[1] ??
                    selectedNode.id,
                  fullyQualifiedName: selectedNode.fullyQualifiedName,
                  entityType: selectedNode.type as EntityType,
                  name: selectedNode.name ?? selectedNode.label,
                  displayName: selectedNode.label,
                } as SearchSourceDetails,
              }}
              handleClosePanel={() => {
                handleClosePanel();
                close();
              }}
            />
          )}
        </SlideoutMenu>
      )}
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
      className={classNames({
        'full-screen-knowledge-graph': isFullscreen,
        'sidebar-collapsed': isFullscreen && preferences?.isSidebarCollapsed,
        'sidebar-expanded': isFullscreen && !preferences?.isSidebarCollapsed,
      })}>
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
            <Box
              align="center"
              className="tw:p-sm tw:w-full"
              data-testid="knowledge-graph-controls"
              justify="between">
              <Box align="center" gap={4}>
                <Typography className="tw:text-secondary" weight="medium">
                  {t('label.view-entity', { entity: t('label.mode') }) + ':'}
                </Typography>
                <Tabs
                  className="tw:w-auto"
                  data-testid="layout-tabs"
                  selectedKey={layout}
                  onSelectionChange={handleLayoutChange}>
                  <Tabs.List
                    items={[
                      {
                        id: 'dagre',
                        label: t('label.hierarchical'),
                      },
                      {
                        id: 'radial',
                        label: t('label.radial'),
                      },
                    ]}
                    size="sm"
                    type="button-minimal">
                    {(tab) => <Tabs.Item {...tab} />}
                  </Tabs.List>
                </Tabs>

                <Divider orientation="vertical" />
                <Dropdown.Root
                  isOpen={entityDropdownOpen}
                  onOpenChange={handleEntityDropdownChange}>
                  <Button
                    color="secondary"
                    isDisabled={entityTypeOptions.length === 0}
                    size="sm">
                    <Box align="center" gap={4}>
                      {selectedEntityTypes.length > 0
                        ? `${t('label.entity-type')} (${
                            selectedEntityTypes.length
                          })`
                        : t('label.entity-type')}
                      <ChevronDown
                        aria-hidden="true"
                        className="tw:size-4 tw:shrink-0 tw:stroke-[2.5px] tw:text-fg-quaternary"
                      />
                    </Box>
                  </Button>
                  <Dropdown.Popover>
                    <div className="tw:border-b tw:border-border-secondary tw:px-4 tw:py-2">
                      <input
                        autoFocus
                        aria-label={t('label.entity-type')}
                        className={filterInputClassName}
                        placeholder={t('label.search')}
                        type="text"
                        value={entityFilterText}
                        onChange={handleEntityFilterChange}
                        onKeyDown={stopKeydownPropagation}
                      />
                    </div>
                    <Dropdown.Menu
                      disallowEmptySelection={false}
                      items={filteredEntityTypeOptions}
                      selectedKeys={new Set(selectedEntityTypes)}
                      selectionMode="multiple"
                      onSelectionChange={handleEntityTypeSelectionChange}>
                      {(item) => (
                        <Dropdown.Item
                          showCheckbox
                          id={item.id}
                          key={item.id}
                          label={item.label}
                        />
                      )}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
                <Divider orientation="vertical" />
                <Dropdown.Root
                  isOpen={relationshipDropdownOpen}
                  onOpenChange={handleRelationshipDropdownChange}>
                  <Button
                    color="secondary"
                    isDisabled={relationshipTypeOptions.length === 0}
                    size="sm">
                    <Box align="center" gap={4}>
                      {selectedRelationshipTypes.length > 0
                        ? `${t('label.relationship-type')} (${
                            selectedRelationshipTypes.length
                          })`
                        : t('label.relationship-type')}
                      <ChevronDown
                        aria-hidden="true"
                        className="tw:size-4 tw:shrink-0 tw:stroke-[2.5px] tw:text-fg-quaternary"
                      />
                    </Box>
                  </Button>
                  <Dropdown.Popover>
                    <div className="tw:border-b tw:border-border-secondary tw:px-4 tw:py-2">
                      <input
                        autoFocus
                        aria-label={t('label.relationship-type')}
                        className={filterInputClassName}
                        placeholder={t('label.search')}
                        type="text"
                        value={relationshipFilterText}
                        onChange={handleRelationshipFilterChange}
                        onKeyDown={stopKeydownPropagation}
                      />
                    </div>
                    <Dropdown.Menu
                      disallowEmptySelection={false}
                      items={filteredRelationshipTypeOptions}
                      selectedKeys={new Set(selectedRelationshipTypes)}
                      selectionMode="multiple"
                      onSelectionChange={handleRelationshipTypeSelectionChange}>
                      {(item) => (
                        <Dropdown.Item
                          showCheckbox
                          id={item.id}
                          key={item.id}
                          label={item.label}
                        />
                      )}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
                <Divider orientation="vertical" />

                <Box align="center" gap={5}>
                  <Typography className="depth-label">
                    {t('label.node-depth') + ':'}
                  </Typography>
                  <Slider
                    showHoverPreview
                    showRange
                    className="depth-slider"
                    data-testid="depth-slider"
                    labelPosition="top-floating"
                    maxValue={5}
                    minValue={1}
                    rangeCount={5}
                    step={1}
                    style={{
                      width: '150px',
                    }}
                    value={[selectedDepth]}
                    onChange={handleDepthChange}
                  />
                </Box>
                <Divider orientation="vertical" />
                <ExportGraphPanel
                  data-testid="knowledge-graph-export"
                  supportedExports={[
                    ExportFormat.PNG,
                    ExportFormat.JSONLD,
                    ExportFormat.TURTLE,
                  ]}
                  onExportJsonLd={handleExportJsonLd}
                  onExportPng={handleExportPng}
                  onExportTurtle={handleExportTurtle}
                />
              </Box>

              {hasActiveFilters && (
                <Button color="link-gray" size="sm" onPress={handleClearAll}>
                  {t('label.clear-entity', { entity: t('label.all') })}
                </Button>
              )}
            </Box>
          }
        />

        <Card.Content className="tw:p-0">
          {knowledgeGraph}

          <div className="knowledge-graph-action-buttons">
            <Tooltip title={t('label.zoom-in')}>
              <TooltipTrigger
                className="kg-control-btn"
                data-testid="zoom-in"
                onPress={handleZoomIn}>
                <ZoomInIcon />
              </TooltipTrigger>
            </Tooltip>
            <Tooltip title={t('label.zoom-out')}>
              <TooltipTrigger
                className="kg-control-btn"
                data-testid="zoom-out"
                onPress={handleZoomOut}>
                <ZoomOutIcon />
              </TooltipTrigger>
            </Tooltip>
            <Tooltip title={t('label.fit-to-screen')}>
              <TooltipTrigger
                className="kg-control-btn"
                data-testid="fit-screen"
                onPress={handleFit}>
                <FitScreenIcon />
              </TooltipTrigger>
            </Tooltip>
            <Tooltip
              title={
                isFullscreen
                  ? t('label.exit-full-screen')
                  : t('label.full-screen-view')
              }>
              <TooltipTrigger
                className="kg-control-btn"
                data-testid={isFullscreen ? 'exit-full-screen' : 'full-screen'}
                onPress={handleFullscreen}>
                {isFullscreen ? <ExitFullScreenIcon /> : <FullscreenIcon />}
              </TooltipTrigger>
            </Tooltip>
            <Tooltip title={t('label.refresh')}>
              <TooltipTrigger
                className="kg-control-btn"
                data-testid="refresh"
                onPress={handleRefresh}>
                <RefreshIcon />
              </TooltipTrigger>
            </Tooltip>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default KnowledgeGraph;
