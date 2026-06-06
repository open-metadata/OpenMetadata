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
  useEffect,
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

function writeNodePositions(
  container: HTMLDivElement | null,
  positions: Record<string, { x: number; y: number }>
) {
  if (container) {
    container.dataset.nodePositions = JSON.stringify(positions);
  }
}

function writeSearchHighlightIds(
  container: HTMLDivElement | null,
  ids: readonly string[] | null
) {
  if (!container) {
    return;
  }
  if (ids) {
    container.dataset.searchHighlightIds = JSON.stringify(ids);
  } else {
    delete container.dataset.searchHighlightIds;
  }
}

function writeEdges(
  container: HTMLDivElement | null,
  edges: ReadonlyArray<{
    from: string;
    to: string;
    relationType: string;
    inverseRelationType?: string;
  }>
) {
  if (container) {
    container.dataset.edges = JSON.stringify(
      edges.map((e) => ({
        from: e.from,
        to: e.to,
        relationType: e.relationType,
        ...(e.inverseRelationType
          ? { inverseRelationType: e.inverseRelationType }
          : {}),
      }))
    );
  }
}

function writeCardinalityMap(
  container: HTMLDivElement | null,
  map: Record<string, { startLabelText: string; endLabelText: string }>
) {
  if (container) {
    container.dataset.cardinalityMap = JSON.stringify(map);
  }
}

const OntologyGraph = forwardRef<OntologyGraphHandle, OntologyGraphProps>(
  (
    {
      nodes: inputNodes,
      edges: inputEdges,
      settings,
      selectedNodeId,
      expandedTermIds,
      glossaries,
      glossaryColorMap,
      dataSignature = '',
      explorationMode = 'model',
      hierarchyCombos,
      graphSearchHighlight = null,
      focusNodeId,
      onNodeClick,
      onNodeDoubleClick,
      onPaneClick,
      onScrollNearEdge,
      nodePositions,
      relationTypes,
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
      cardinalityLabelMap,
    } = useGraphDataBuilder({
      inputNodes,
      inputEdges,
      explorationMode,
      settings,
      selectedNodeId: selectedNodeId ?? null,
      expandedTermIds,
      clickedEdgeId,
      glossaries,
      glossaryColorMap,
      hierarchyCombos: hierarchyCombos ?? [],
      graphSearchHighlight,
      layoutType,
      nodePositions,
      relationTypes,
    });

    const {
      graphRef,
      extractNodePositions,
      suppressEdgeCheck,
      emitPagePositions,
    } = useOntologyGraph({
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
      onPaneClick,
      onScrollNearEdge,
      setClickedEdgeId,
      neighborSet,
      glossaryColorMap,
      computeNodeColor,
      assetToTermMap,
      onPositionsReady: (positions) => {
        writeNodePositions(containerRef.current, positions);
        if (containerRef.current && graphRef.current) {
          containerRef.current.dataset.graphZoom = String(
            graphRef.current.getZoom()
          );
        }
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        fitView: async () => {
          const graph = graphRef.current;
          if (!graph) {
            return;
          }
          writeNodePositions(containerRef.current, {});
          suppressEdgeCheck(800);
          await fitViewWithMinZoom(graph, 300);
          emitPagePositions(graph);
        },
        zoomIn: () => {
          suppressEdgeCheck();
          graphRef.current?.zoomBy(1.2, { duration: 100 });
        },
        zoomOut: () => {
          suppressEdgeCheck();
          graphRef.current?.zoomBy(0.8, { duration: 100 });
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
          // G6 only supports raster image export here; keep the SVG wrapper explicit.
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
          a.download = 'ontology-graph-raster.svg';
          a.click();
          URL.revokeObjectURL(url);
        },
      }),
      [explorationMode, extractNodePositions, graphRef, suppressEdgeCheck]
    );

    useEffect(() => {
      writeSearchHighlightIds(
        containerRef.current,
        graphSearchHighlight?.active
          ? graphSearchHighlight.highlightedNodeIds
          : null
      );
    }, [graphSearchHighlight]);

    useEffect(() => {
      writeEdges(containerRef.current, mergedEdgesList);
    }, [mergedEdgesList]);

    useEffect(() => {
      writeCardinalityMap(containerRef.current, cardinalityLabelMap);
    }, [cardinalityLabelMap]);

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
