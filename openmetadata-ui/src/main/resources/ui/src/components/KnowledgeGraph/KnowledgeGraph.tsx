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
  Card,
  Divider,
  SlideoutMenu,
  Slider,
  Tabs,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isArray } from 'lodash';
import Qs from 'qs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as ExitFullScreenIcon } from '../../assets/svg/ic-exit-fullscreen.svg';
import { ReactComponent as FitScreenIcon } from '../../assets/svg/ic-fit-screen.svg';
import { ReactComponent as FullscreenIcon } from '../../assets/svg/ic-fullscreen.svg';
import { ReactComponent as LineageIcon } from '../../assets/svg/ic-platform-lineage.svg';
import { ReactComponent as ZoomInIcon } from '../../assets/svg/ic-zoom-in.svg';
import { ReactComponent as ZoomOutIcon } from '../../assets/svg/ic-zoom-out.svg';
import { ReactComponent as RefreshIcon } from '../../assets/svg/reload.svg';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import { useTheme } from '../../context/UntitledUIThemeProvider/theme-provider';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { getEntityGraphData } from '../../rest/rdfAPI';
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
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntitySummaryPanel from '../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { SearchSourceDetails } from '../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';
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
      const data = await getEntityGraphData(
        entity.id,
        entityType,
        selectedDepth
      );
      setGraphData(data);
    } finally {
      setLoading(false);
    }
  }, [entity?.id, entityType, selectedDepth, t]);

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
        networkRef.current?.zoomTo(currentZoom * 0.8).then(() => {
          networkRef.current?.translateBy([0, 28]);
        });
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

  useEffect(() => {
    if (!containerRef.current || !graphData || loading) {
      return;
    }

    const g6Data = transformToG6Format(graphData);
    const width = containerRef.current.offsetWidth || 800;
    const height = containerRef.current.offsetHeight || 600;

    const maxEdgeLabelLen =
      g6Data.edges?.reduce(
        (max, e) => Math.max(max, String(e.data?.label).length),
        0
      ) ?? 0;

    const dagreNodesep = NODE_HEIGHT + 48;
    const dagreRanksep = NODE_WIDTH + Math.max(300, maxEdgeLabelLen * 8);

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
      fill: '#ffffff',
      stroke: '#d9d9d9',
      lineWidth: 1.5,
    };

    const radialRightPort = {
      key: 'right',
      placement: [1.04, 0.5] as [number, number],
      r: 6,
      fill: '#ffffff',
      stroke: '#d9d9d9',
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

    return () => {
      graph.destroy();
    };
  }, [
    graphData,
    loading,
    layout,
    entity?.id,
    isFullscreen,
    transformToG6Format,
  ]);

  useEffect(() => {
    if (entity?.id) {
      fetchGraphData();
    }
  }, [fetchGraphData]);

  const hasNoData = !graphData || graphData.nodes.length === 0;

  const graphCanvas = (
    <>
      <Card
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
        <Card
          className="knowledge-graph-controls"
          data-testid="knowledge-graph-controls"
          size="sm">
          <Card.Content className="tw:flex tw:items-center tw:gap-4">
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
                rangeCount={3}
                step={1}
                style={{
                  width: '150px',
                }}
                value={[selectedDepth]}
                onChange={handleDepthChange}
              />
            </Box>
          </Card.Content>
        </Card>

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
      </Card>
    </div>
  );
};

export default KnowledgeGraph;
