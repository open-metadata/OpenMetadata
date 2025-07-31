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
  AimOutlined,
  FullscreenOutlined,
  NodeCollapseOutlined,
  PartitionOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Select,
  Slider,
  Space,
  Spin,
  Tooltip,
} from 'antd';
import { AxiosError } from 'axios';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DataSet } from 'vis-data';
import { Network, Options } from 'vis-network';
import { EntityReference } from '../../generated/entity/type';
import { getEntityGraphData } from '../../rest/rdfAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import './KnowledgeGraph.style.less';
import KnowledgeGraphNodeDetails from './KnowledgeGraphNodeDetails';

interface KnowledgeGraphProps {
  entity: EntityReference;
  entityType: string;
  depth?: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: string;
  title?: string;
  description?: string;
  owner?: string;
  tags?: Array<{ name: string; tagFQN: string }>;
  name?: string;
  fullyQualifiedName?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  arrows?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  entity,
  entityType,
  depth = 1,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(depth);
  const [layout, setLayout] = useState<'hierarchical' | 'force'>(
    'hierarchical'
  );
  const [, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const networkOptions: Options = useMemo(
    () => ({
      nodes: {
        shape: 'box',
        widthConstraint: {
          minimum: 150,
          maximum: 250,
        },
        heightConstraint: {
          minimum: 60,
          maximum: 80,
        },
        font: {
          size: 12,
          color: '#262626',
          face: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial',
          multi: true,
          align: 'left',
        },
        borderWidth: 1,
        borderWidthSelected: 2,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.08)',
          size: 10,
          x: 2,
          y: 2,
        },
        margin: {
          top: 8,
          bottom: 8,
          left: 12,
          right: 12,
        },
        borderRadius: 8,
      },
      edges: {
        width: 1.5,
        color: {
          color: '#d9d9d9',
          highlight: '#1890ff',
          hover: '#40a9ff',
        },
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 1,
            type: 'arrow',
          },
        },
        font: {
          size: 12,
          align: 'horizontal',
          background: 'rgba(255, 255, 255, 0.9)',
          strokeWidth: 3,
          strokeColor: '#ffffff',
          vadjust: -5,
        },
        smooth: {
          enabled: true,
          type: 'cubicBezier',
          forceDirection: 'horizontal',
          roundness: 0.8,
        },
        chosen: {
          edge: function (values) {
            values.width = 2.5;
            values.color = '#1890ff';
          },
        },
      },
      groups: {
        table: {
          color: {
            background: '#ffffff',
            border: '#52c41a',
            highlight: { background: '#f6ffed', border: '#52c41a' },
            hover: { background: '#f6ffed', border: '#52c41a' },
          },
          font: { color: '#262626' },
        },
        database: {
          color: {
            background: '#ffffff',
            border: '#1890ff',
            highlight: { background: '#e6f7ff', border: '#1890ff' },
            hover: { background: '#e6f7ff', border: '#1890ff' },
          },
          font: { color: '#262626' },
        },
        schema: {
          color: {
            background: '#ffffff',
            border: '#fa8c16',
            highlight: { background: '#fff7e6', border: '#fa8c16' },
            hover: { background: '#fff7e6', border: '#fa8c16' },
          },
          font: { color: '#262626' },
        },
        pipeline: {
          color: {
            background: '#ffffff',
            border: '#722ed1',
            highlight: { background: '#f9f0ff', border: '#722ed1' },
            hover: { background: '#f9f0ff', border: '#722ed1' },
          },
          font: { color: '#262626' },
        },
        dashboard: {
          color: {
            background: '#ffffff',
            border: '#eb2f96',
            highlight: { background: '#fff0f6', border: '#eb2f96' },
            hover: { background: '#fff0f6', border: '#eb2f96' },
          },
          font: { color: '#262626' },
        },
        user: {
          color: {
            background: '#ffffff',
            border: '#13c2c2',
            highlight: { background: '#e6fffb', border: '#13c2c2' },
            hover: { background: '#e6fffb', border: '#13c2c2' },
          },
          font: { color: '#262626' },
        },
        team: {
          color: {
            background: '#ffffff',
            border: '#2f54eb',
            highlight: { background: '#f0f5ff', border: '#2f54eb' },
            hover: { background: '#f0f5ff', border: '#2f54eb' },
          },
          font: { color: '#262626' },
        },
        tag: {
          color: {
            background: '#ffffff',
            border: '#f5222d',
            highlight: { background: '#fff1f0', border: '#f5222d' },
            hover: { background: '#fff1f0', border: '#f5222d' },
          },
          font: { color: '#262626' },
        },
        glossaryterm: {
          color: {
            background: '#ffffff',
            border: '#faad14',
            highlight: { background: '#fffbe6', border: '#faad14' },
            hover: { background: '#fffbe6', border: '#faad14' },
          },
          font: { color: '#262626' },
        },
        glossary: {
          color: {
            background: '#ffffff',
            border: '#d48806',
            highlight: { background: '#fff9e6', border: '#d48806' },
            hover: { background: '#fff9e6', border: '#d48806' },
          },
          font: { color: '#262626' },
        },
        domain: {
          color: {
            background: '#ffffff',
            border: '#531dab',
            highlight: { background: '#f9f0ff', border: '#531dab' },
            hover: { background: '#f9f0ff', border: '#531dab' },
          },
          font: { color: '#262626' },
        },
        dataproduct: {
          color: {
            background: '#ffffff',
            border: '#389e0d',
            highlight: { background: '#f6ffed', border: '#389e0d' },
            hover: { background: '#f6ffed', border: '#389e0d' },
          },
          font: { color: '#262626' },
        },
        topic: {
          color: {
            background: '#ffffff',
            border: '#08979c',
            highlight: { background: '#e6fffb', border: '#08979c' },
            hover: { background: '#e6fffb', border: '#08979c' },
          },
          font: { color: '#262626' },
        },
        container: {
          color: {
            background: '#ffffff',
            border: '#0958d9',
            highlight: { background: '#f0f5ff', border: '#0958d9' },
            hover: { background: '#f0f5ff', border: '#0958d9' },
          },
          font: { color: '#262626' },
        },
        mlmodel: {
          color: {
            background: '#ffffff',
            border: '#c41d7f',
            highlight: { background: '#fff0f6', border: '#c41d7f' },
            hover: { background: '#fff0f6', border: '#c41d7f' },
          },
          font: { color: '#262626' },
        },
        storedprocedure: {
          color: {
            background: '#ffffff',
            border: '#7cb305',
            highlight: { background: '#fcffe6', border: '#7cb305' },
            hover: { background: '#fcffe6', border: '#7cb305' },
          },
          font: { color: '#262626' },
        },
        searchindex: {
          color: {
            background: '#ffffff',
            border: '#d4380d',
            highlight: { background: '#fff2e8', border: '#d4380d' },
            hover: { background: '#fff2e8', border: '#d4380d' },
          },
          font: { color: '#262626' },
        },
        default: {
          color: {
            background: '#ffffff',
            border: '#d9d9d9',
            highlight: { background: '#fafafa', border: '#8c8c8c' },
            hover: { background: '#fafafa', border: '#8c8c8c' },
          },
          font: { color: '#262626' },
        },
      },
      layout:
        layout === 'hierarchical'
          ? {
              hierarchical: {
                direction: 'LR',
                sortMethod: 'directed',
                levelSeparation: 400,
                nodeSpacing: 200,
                treeSpacing: 250,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
              },
            }
          : {
              improvedLayout: true,
              clusterThreshold: 150,
            },
      physics: {
        enabled: layout === 'force',
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -300,
          centralGravity: 0.01,
          springLength: 350,
          springConstant: 0.04,
          damping: 0.3,
          avoidOverlap: 1.5,
        },
        stabilization: {
          enabled: true,
          iterations: 200,
          updateInterval: 25,
        },
        minVelocity: 0.75,
        maxVelocity: 30,
      },
      interaction: {
        hover: true,
        tooltipDelay: 300,
        hideEdgesOnDrag: true,
        hideEdgesOnZoom: true,
        navigationButtons: true,
        keyboard: {
          enabled: true,
        },
      },
    }),
    [layout]
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
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.entity-graph-fetch-error'));
    } finally {
      setLoading(false);
    }
  }, [entity?.id, entityType, selectedDepth, t]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  useEffect(() => {
    if (!containerRef.current || !graphData || loading) {
      return;
    }

    // Enhance nodes with better tooltips and styling
    const enhancedNodes = graphData.nodes.map((node) => {
      const isCurrentEntity = node.id.includes(entity.id);

      // Get icon for node type
      const getNodeIcon = (type: string) => {
        const icons: Record<string, string> = {
          table: '📊',
          database: '🗄️',
          schema: '📁',
          pipeline: '⚡',
          dashboard: '📈',
          user: '👤',
          team: '👥',
          tag: '🏷️',
          glossaryterm: '📖',
          glossary: '📚',
          domain: '🏛️',
          dataproduct: '📦',
          topic: '📨',
          container: '📦',
          mlmodel: '🤖',
          storedprocedure: '⚙️',
          searchindex: '🔍',
        };

        return icons[type.toLowerCase()] || '📄';
      };

      // Create structured label for rectangular nodes
      const icon = getNodeIcon(node.type);
      const displayName = node.label || node.name || '';
      const nodeLabel = `${icon} <b>${displayName}</b>\n<code>${node.type}</code>`;

      return {
        ...node,
        label: nodeLabel,
        title: false, // Disable default HTML tooltip
        font: {
          size: isCurrentEntity ? 12 : 11,
          multi: true,
          bold: {
            size: isCurrentEntity ? 13 : 12,
          },
        },
        borderWidth: isCurrentEntity ? 3 : 1,
        margin: {
          top: 10,
          bottom: 10,
          left: 15,
          right: 15,
        },
        chosen: {
          node: function (values, id, selected, hovering) {
            values.borderWidth = isCurrentEntity ? 4 : 2;
            if (hovering) {
              values.shadow = true;
              values.shadowColor = 'rgba(0,0,0,0.2)';
              values.shadowSize = 15;
            }
          },
        },
      };
    });

    // Create vis network
    const nodes = new DataSet(enhancedNodes);
    const edges = new DataSet(graphData.edges);

    const data = {
      nodes: nodes,
      edges: edges,
    };

    networkRef.current = new Network(
      containerRef.current,
      data,
      networkOptions
    );

    // Add event handlers
    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId) as GraphNode;
        setSelectedNode(node);
      } else {
        setSelectedNode(null);
      }
    });

    // Add double-click handler for navigation
    networkRef.current.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId) as GraphNode;
        if (node.type && node.id) {
          const entityIdMatch = node.id.match(/\/([a-f0-9-]{36})$/);
          if (entityIdMatch) {
            const entityId = entityIdMatch[1];
            window.open(`/${node.type}/${entityId}`, '_blank');
          }
        }
      }
    });

    // Enhanced hover effects
    networkRef.current.on('hoverNode', (params) => {
      networkRef.current?.canvas.body.container.style.cursor = 'pointer';
      const nodeId = params.node;
      const node = nodes.get(nodeId) as GraphNode;
      setHoveredNode(node);
    });

    networkRef.current.on('blurNode', () => {
      networkRef.current?.canvas.body.container.style.cursor = 'default';
      setHoveredNode(null);
    });

    // Stabilization complete - center on current entity
    networkRef.current.on('stabilizationIterationsDone', () => {
      networkRef.current?.setOptions({ physics: { enabled: false } });

      // Center on current entity
      const currentNodeId = graphData.nodes.find((node) =>
        node.id.includes(entity.id)
      )?.id;
      if (currentNodeId) {
        networkRef.current?.focus(currentNodeId, {
          scale: 1.2,
          animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad',
          },
        });
      }
    });

    return () => {
      networkRef.current?.destroy();
    };
  }, [graphData, loading, networkOptions, entity.id]);

  // Re-fetch data when depth changes
  useEffect(() => {
    if (entity?.id) {
      fetchGraphData();
    }
  }, [selectedDepth]);

  const handleFit = () => {
    networkRef.current?.fit({
      animation: {
        duration: 1000,
        easingFunction: 'easeInOutQuad',
      },
    });
  };

  const handleLayoutChange = (value: 'hierarchical' | 'force') => {
    setLayout(value);
  };

  const handleDepthChange = (value: number) => {
    setSelectedDepth(value);
  };

  if (!entity) {
    return <Empty description={t('message.no-entity-selected')} />;
  }

  const handleZoomIn = () => {
    const scale = networkRef.current?.getScale() || 1;
    networkRef.current?.moveTo({ scale: scale * 1.2 });
  };

  const handleZoomOut = () => {
    const scale = networkRef.current?.getScale() || 1;
    networkRef.current?.moveTo({ scale: scale * 0.8 });
  };

  const handleFullscreen = () => {
    const graphContainer = document.querySelector('.knowledge-graph-container');
    if (graphContainer) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        (graphContainer as HTMLElement).requestFullscreen();
      }
    }
  };

  return (
    <div className="knowledge-graph-container">
      <Card title={t('label.knowledge-graph')}>
        <div className="knowledge-graph-controls">
          <div className="depth-slider-container">
            <span className="depth-label">{t('label.depth')}</span>
            <Slider
              className="depth-slider"
              marks={{
                1: '1',
                5: '5',
                10: '10',
              }}
              max={10}
              min={1}
              tooltip={{
                formatter: (value) => `${t('label.depth')}: ${value}`,
              }}
              value={selectedDepth}
              onChange={handleDepthChange}
            />
          </div>
          <Select
            options={[
              {
                label: (
                  <Space>
                    <NodeCollapseOutlined />
                    {t('label.force')}
                  </Space>
                ),
                value: 'force',
              },
              {
                label: (
                  <Space>
                    <PartitionOutlined />
                    {t('label.hierarchical')}
                  </Space>
                ),
                value: 'hierarchical',
              },
            ]}
            size="small"
            value={layout}
            onChange={handleLayoutChange}
          />
          <Space.Compact>
            <Tooltip title={t('label.zoom-in')}>
              <Button
                icon={<ZoomInOutlined />}
                size="small"
                onClick={handleZoomIn}
              />
            </Tooltip>
            <Tooltip title={t('label.zoom-out')}>
              <Button
                icon={<ZoomOutOutlined />}
                size="small"
                onClick={handleZoomOut}
              />
            </Tooltip>
            <Tooltip title={t('label.fit-to-screen')}>
              <Button icon={<AimOutlined />} size="small" onClick={handleFit} />
            </Tooltip>
            <Tooltip title={t('label.fullscreen')}>
              <Button
                icon={<FullscreenOutlined />}
                size="small"
                onClick={handleFullscreen}
              />
            </Tooltip>
            <Tooltip title={t('label.refresh')}>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                size="small"
                onClick={fetchGraphData}
              />
            </Tooltip>
          </Space.Compact>
        </div>

        {loading ? (
          <div className="knowledge-graph-loading">
            <Spin size="large" tip={t('label.loading-graph')} />
          </div>
        ) : !graphData || graphData.nodes.length === 0 ? (
          <div className="knowledge-graph-empty">
            <Empty
              description={t('message.no-data-available')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <>
            <div className="knowledge-graph-canvas" ref={containerRef} />

            {/* Selected node details */}
            {selectedNode && (
              <KnowledgeGraphNodeDetails
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onNavigate={(nodeId) => {
                  const entityIdMatch = nodeId.match(/\/([a-f0-9-]{36})$/);
                  if (entityIdMatch) {
                    const entityId = entityIdMatch[1];
                    const entityType = selectedNode.type;
                    window.open(`/${entityType}/${entityId}`, '_blank');
                  }
                }}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default KnowledgeGraph;
