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
  IElementEvent,
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
import type { Selection } from 'react-aria-components';
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
import {
  downloadEntityGraph,
  EntityGraphExportFormat,
  getEntityGraphData,
} from '../../rest/rdfAPI';
import {
  getEntityBreadcrumbs,
  getEntityLinkFromType,
} from '../../utils/EntityUtils';
import {
  computeRadialPositions,
  findHighlightPath,
  MAX_NODE_WIDTH,
  NODE_HEIGHT,
  NODE_WIDTH,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntitySummaryPanel from '../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { SearchSourceDetails } from '../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';
import ExportGraphPanel, {
  ExportFormat,
} from '../OntologyExplorer/ExportGraphPanel';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import CustomNode from './GraphElements/CustomNode';
import {
  GraphData,
  GraphNode,
  KnowledgeGraphProps,
} from './KnowledgeGraph.interface';
import './KnowledgeGraph.style.less';

register(ExtensionCategory.NODE, 'react-node', AntVReactNode);

const ENTITY_UUID_REGEX = /\/([a-f0-9-]{36})$/;

export type KnowledgeGraphLayout = 'dagre' | 'radial';

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
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(depth);
  const [layout, setLayout] = useState<KnowledgeGraphLayout>('dagre');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
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
    t,
    selectedEntityTypes,
    selectedRelationshipTypes,
  ]);

  const renderNode = useCallback(
    (data: G6NodeData) => <CustomNode nodeData={data} />,
    []
  );

  const handleFit = () => {
    if (networkRef.current) {
      void networkRef.current.fitView().then(() => {
        const currentZoom = networkRef.current?.getZoom() ?? 1;

        // Since we have a floating toolbar inside the container
        // zoom out a bit more and translate down to ensure the whole graph is visible
        // and not obscured by the toolbar
        networkRef.current?.zoomTo(currentZoom * 0.9);
      });
    }
  };

  const handleDepthChange = (value: number | number[]) => {
    setSelectedDepth(isArray(value) ? value[0] : value);
  };

  const handleZoomIn = () => {
    if (networkRef.current) {
      const currentZoom = networkRef.current.getZoom();
      void networkRef.current.zoomTo(currentZoom * 1.2, {
        duration: 300,
        easing: 'easeCubic',
      });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const currentZoom = networkRef.current.getZoom();
      void networkRef.current.zoomTo(currentZoom * 0.8, {
        duration: 300,
        easing: 'easeCubic',
      });
    }
  };

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

  const getExportHandler = (format: ExportFormat) => async () => {
    if (!entity?.id || !entityType) {
      showErrorToast(
        t('label.no-entity-selected', { entity: t('label.asset') })
      );

      return;
    }

    const apiFormatMap: Partial<Record<ExportFormat, EntityGraphExportFormat>> =
      {
        [ExportFormat.JSONLD]: 'jsonld',
        [ExportFormat.TURTLE]: 'turtle',
      };
    const apiFormat = apiFormatMap[format];

    if (!apiFormat) {
      showErrorToast(t('server.unexpected-error'));

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
        format: apiFormat,
      });
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  };

  // The main effect that initializes the graph after data is loaded and whenever
  useEffect(() => {
    if (!containerRef.current || !graphData || loading) {
      return;
    }

    const g6Data = transformToG6Format(graphData);
    const width = containerRef.current.offsetWidth || 800;
    const height = containerRef.current.offsetHeight || 600;

    // Set max edge length based on number of edges to help keep the graph flexible with larger datasets
    // The base length of 300 works well for small graphs,
    // while the scaling factor of 200 keeps larger graphs from becoming too cramped.
    // These values can be adjusted based on testing with typical graph sizes in your application.
    // The square root scaling provides diminishing returns as the graph grows,
    // which helps prevent excessively long edges in very large graphs while still allowing for more space as needed.
    const maxEdgeLen = Math.max(
      300,
      Math.sqrt(g6Data.nodes?.length ?? 0) * 200
    );

    const dagreNodesep = NODE_HEIGHT + 48;
    const dagreRanksep = NODE_WIDTH + maxEdgeLen;

    const focusNodeId = entity?.id
      ? (g6Data.nodes ?? []).find(
          (n) => n.id === entity.id || n.id.endsWith(entity.id)
        )?.id ?? entity.id
      : '';

    // Focus node keeps fixed dimensions regardless of content
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
      const positions = computeRadialPositions(
        g6Data.nodes ?? [],
        g6Data.edges ?? [],
        focusNodeId,
        width / 2,
        height / 2
      );
      g6Data.nodes = (g6Data.nodes ?? []).map((node) => {
        const pos = positions.get(node.id);

        return pos
          ? { ...node, style: { ...node.style, x: pos.x, y: pos.y } }
          : node;
      });

      // Apply a uniform curveOffset to all radial edges. Because G6's offset
      // is perpendicular to the travel direction, two edges that connect the
      // same pair of nodes in opposite directions automatically curve to
      // opposite sides with the same sign — keeping bidirectional arcs
      // separated without any per-edge sign logic.
      g6Data.edges = (g6Data.edges ?? []).map((edge) => ({
        ...edge,
        style: { ...edge.style, curveOffset: 50 },
      }));
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
      // Build a position map from the already-updated node styles
      const posMap = new Map<string, number>();
      (g6Data.nodes ?? []).forEach((n) => {
        posMap.set(n.id, (n.style?.x as number) ?? width / 2);
      });

      g6Data.nodes = (g6Data.nodes ?? []).map((node) => {
        if (node.id === focusNodeId) {
          return node;
        }

        const myX = posMap.get(node.id) ?? width / 2;
        let needsLeft = false;
        let needsRight = false;

        (g6Data.edges ?? []).forEach((edge) => {
          let otherId: string | null = null;
          if (edge.source === node.id) {
            otherId = edge.target;
          } else if (edge.target === node.id) {
            otherId = edge.source;
          }
          if (otherId !== null) {
            const otherX = posMap.get(otherId) ?? width / 2;
            if (otherX < myX) {
              needsLeft = true;
            } else {
              needsRight = true;
            }
          }
        });

        const ports = [
          ...(needsLeft ? [radialLeftPort] : []),
          ...(needsRight ? [radialRightPort] : []),
        ];

        return { ...node, style: { ...node.style, ports } };
      });
    } else {
      g6Data.nodes = (g6Data.nodes ?? []).map((node) => ({
        ...node,
        style: { ...node.style, ports: dagrePorts },
      }));
    }

    const graph = new Graph({
      container: containerRef.current,
      width,
      height,
      data: g6Data,
      layout:
        layout === 'dagre'
          ? {
              type: 'dagre',
              rankdir: 'RL',
              nodesep: dagreNodesep,
              ranksep: dagreRanksep,
              edgesep: 150,
              radial: false,
            }
          : { type: 'preset' },
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
          stroke: '#d9d9d9',
          lineWidth: 1.5,
          endArrow: true,
          labelBackgroundPadding: [3, 6],
        },
        state: {
          selected: {
            stroke: brandColors?.primaryColor,
            lineWidth: 1.5,
            haloOpacity: 0,
          },
        },
      },
    });

    void graph.render().then(() => {
      if (entity?.id) {
        void graph.fitView();
        void graph.focusElement(focusNodeId);
        graph.updateNodeData(
          (g6Data.nodes ?? []).map((n) => ({
            id: n.id,
            data: { ...n.data, highlighted: n.id === focusNodeId },
          }))
        );
        void graph.draw();
      }
    });

    const applyPathHighlight = (nodeId: string) => {
      const { nodeIds: pathNodes, edgeIds: pathEdges } = findHighlightPath(
        focusNodeId,
        nodeId,
        g6Data.nodes ?? [],
        g6Data.edges ?? []
      );
      graph.updateNodeData(
        (g6Data.nodes ?? []).map((n) => ({
          id: n.id,
          data: { ...n.data, highlighted: pathNodes.has(n.id) },
        }))
      );
      void graph.draw();
      (g6Data.edges ?? []).forEach((e) => {
        const edgeId = String(e.id);
        void graph.setElementState(
          edgeId,
          pathEdges.has(edgeId) ? 'selected' : []
        );
      });
    };

    const clearAllHighlights = () => {
      graph.updateNodeData(
        (g6Data.nodes ?? []).map((n) => ({
          id: n.id,
          data: { ...n.data, highlighted: false },
        }))
      );
      void graph.draw();
      (g6Data.edges ?? []).forEach(
        (e) => void graph.setElementState(String(e.id), [])
      );
    };

    graph.on('node:click', (evt: IElementEvent) => {
      const nodeId = evt.target.id;
      if (nodeId) {
        const node = graphData.nodes.find((n) => n.id === nodeId);
        setSelectedNode(node || null);
        selectedNodeIdRef.current = nodeId;
        applyPathHighlight(nodeId);
      }
    });

    graph.on('node:dblclick', (evt: IElementEvent) => {
      const nodeId = evt.target.id;
      if (nodeId) {
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (node?.type && node?.fullyQualifiedName) {
          const path = getEntityLinkFromType(
            node.fullyQualifiedName,
            node.type as EntityType
          );

          window.open(path, '_blank', 'noopener,noreferrer');
        }
      }
    });

    graph.on('node:pointerover', (evt: IElementEvent) => {
      const nodeId = evt.target.id;
      if (nodeId) {
        applyPathHighlight(nodeId);
      }
    });

    graph.on('node:pointerleave', (evt: IElementEvent) => {
      const nodeId = evt.target.id;
      if (nodeId) {
        if (selectedNodeIdRef.current) {
          applyPathHighlight(selectedNodeIdRef.current);
        } else {
          clearAllHighlights();
        }
      }
    });

    graph.on('canvas:click', () => {
      setSelectedNode(null);
      selectedNodeIdRef.current = null;
      clearAllHighlights();
    });

    networkRef.current = graph;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && networkRef.current) {
        networkRef.current.resize(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight
        );
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (networkRef.current === graph) {
        networkRef.current = null;
      }
      graph.destroy();
      resizeObserver.disconnect();
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
        ref={containerRef}
      />

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

      {selectedNode?.fullyQualifiedName && (
        <SlideoutMenu
          isDismissable
          isOpen
          className="tw:z-1100"
          dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0"
          width={576}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSelectedNode(null);
            }
          }}>
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
                setSelectedNode(null);
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
                  onSelectionChange={(key) =>
                    setLayout(key as KnowledgeGraphLayout)
                  }>
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
                  onOpenChange={(open) => {
                    setEntityDropdownOpen(open);
                    if (!open) {
                      setEntityFilterText('');
                    }
                  }}>
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
                        onChange={(e) => setEntityFilterText(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
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
                  onOpenChange={(open) => {
                    setRelationshipDropdownOpen(open);
                    if (!open) {
                      setRelationshipFilterText('');
                    }
                  }}>
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
                        onChange={(e) =>
                          setRelationshipFilterText(e.target.value)
                        }
                        onKeyDown={(e) => e.stopPropagation()}
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
                  onExportJsonLd={getExportHandler(ExportFormat.JSONLD)}
                  onExportPng={handleExportPng}
                  onExportTurtle={getExportHandler(ExportFormat.TURTLE)}
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
                onPress={() => void fetchGraphData()}>
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
