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
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useGraphDataBuilder } from './hooks/useGraphData';
import { useOntologyGraph } from './hooks/useOntologyGraph';
import {
  fitViewWithMinZoom,
  toLayoutEngineType,
  type LayoutEngineType,
} from './OntologyExplorer.constants';
import {
  OntologyGraphHandle,
  OntologyGraphProps,
} from './OntologyExplorer.interface';

const OntologyGraph = forwardRef<OntologyGraphHandle, OntologyGraphProps>(
  (
    {
      nodes: inputNodes,
      edges: inputEdges,
      settings,
      selectedNodeId,
      expandedTermIds,
      glossaryColorMap,
      dataSignature = '',
      explorationMode = 'model',
      hierarchyCombos,
      graphSearchHighlight = null,
      focusNodeId,
      onNodeClick,
      onNodeDoubleClick,
      onNodeContextMenu,
      onPaneClick,
      onScrollNearEdge,
      nodePositions,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const [clickedEdgeId, setClickedEdgeId] = useState<string | null>(null);

    const getLayoutType = useCallback((): LayoutEngineType => {
      return toLayoutEngineType(settings.layout);
    }, [settings.layout]);

    const layoutType = getLayoutType();

    const {
      graphData,
      mergedEdgesList,
      neighborSet,
      computeNodeColor,
      assetToTermMap,
    } = useGraphDataBuilder({
      inputNodes,
      inputEdges,
      explorationMode,
      settings,
      selectedNodeId: selectedNodeId ?? null,
      expandedTermIds,
      clickedEdgeId,
      glossaryColorMap,
      hierarchyCombos: hierarchyCombos ?? [],
      graphSearchHighlight,
      layoutType,
      nodePositions,
    });

    const { graphRef, extractNodePositions, suppressEdgeCheck } =
      useOntologyGraph({
        containerRef,
        graphData,
        inputNodes,
        mergedEdgesList,
        explorationMode,
        settings,
        layoutType,
        focusNodeId,
        selectedNodeId,
        expandedTermIds,
        dataSignature,
        onNodeClick,
        onNodeDoubleClick,
        onNodeContextMenu,
        onPaneClick,
        onScrollNearEdge,
        setClickedEdgeId,
        neighborSet,
        glossaryColorMap,
        computeNodeColor,
        assetToTermMap,
      });

    useImperativeHandle(
      ref,
      () => ({
        fitView: async () => {
          const graph = graphRef.current;
          if (!graph) {
            return;
          }
          suppressEdgeCheck(800);
          await fitViewWithMinZoom(graph, 300);
        },
        zoomIn: () => {
          suppressEdgeCheck();
          graphRef.current?.zoomBy(1.2);
        },
        zoomOut: () => {
          suppressEdgeCheck();
          graphRef.current?.zoomBy(0.8);
        },
        runLayout: () => {
          const graph = graphRef.current;
          if (!graph) {
            return;
          }
          graph.layout();
        },
        focusNode: (nodeId: string) => {
          graphRef.current?.focusElement(nodeId, { duration: 0 });
        },
        getNodePositions: () => extractNodePositions(),
        exportAsPng: async () => {
          const graph = graphRef.current;
          if (!graph) {
            return;
          }
          const dataUrl = await graph.toDataURL({
            mode: 'overall',
            type: 'image/png',
          });
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'ontology-graph.png';
          a.click();
        },
        exportAsSvg: async () => {
          const graph = graphRef.current;
          if (!graph) {
            return;
          }
          const dataUrl = await graph.toDataURL({
            mode: 'overall',
            type: 'image/png',
          });
          const [width, height] = graph.getCanvas().getSize();
          const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <image href="${dataUrl}" width="${width}" height="${height}"/>
</svg>`;
          const blob = new Blob([svgStr], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'ontology-graph.svg';
          a.click();
          URL.revokeObjectURL(url);
        },
      }),
      [explorationMode, extractNodePositions, graphRef, suppressEdgeCheck]
    );

    return (
      <div
        className="tw:w-full tw:h-full tw:relative ontology-g6-container"
        ref={containerRef}
      />
    );
  }
);

OntologyGraph.displayName = 'OntologyGraph';

export default OntologyGraph;
