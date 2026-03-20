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
  LayoutEngine,
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
      nodePositions,
      selectedNodeId,
      glossaryColorMap,
      dataSignature = '',
      explorationMode = 'model',
      hierarchyCombos,
      focusNodeId,
      onNodeClick,
      onNodeDoubleClick,
      onNodeContextMenu,
      onPaneClick,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const [clickedEdgeId, setClickedEdgeId] = useState<string | null>(null);

    const getLayoutType = useCallback((): LayoutEngineType => {
      if (explorationMode === 'data') {
        return LayoutEngine.Radial;
      }

      return toLayoutEngineType(settings.layout);
    }, [settings.layout, explorationMode]);

    const layoutType = getLayoutType();

    const { graphData, mergedEdgesList, neighborSet, computeNodeColor } =
      useGraphDataBuilder({
        inputNodes,
        inputEdges,
        explorationMode,
        settings,
        selectedNodeId: selectedNodeId ?? null,
        clickedEdgeId,
        nodePositions,
        glossaryColorMap,
        layoutType,
        hierarchyCombos: hierarchyCombos ?? [],
      });

    const { graphRef, extractNodePositions } = useOntologyGraph({
      containerRef,
      graphData,
      inputNodes,
      mergedEdgesList,
      explorationMode,
      settings,
      layoutType,
      focusNodeId,
      selectedNodeId,
      dataSignature,
      onNodeClick,
      onNodeDoubleClick,
      onNodeContextMenu,
      onPaneClick,
      setClickedEdgeId,
      neighborSet,
      glossaryColorMap,
      computeNodeColor,
    });

    useImperativeHandle(
      ref,
      () => ({
        fitView: () => {
          const graph = graphRef.current;
          if (!graph) {
            return;
          }
          const duration = 300;
          graph.fitView(undefined, { duration });
          graph.zoomBy(0.6, { duration });
        },
        zoomIn: () => {
          graphRef.current?.zoomBy(1.2);
        },
        zoomOut: () => {
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
      }),
      [extractNodePositions, graphRef]
    );

    return (
      <div
        className="w-full h-full relative ontology-g6-container"
        ref={containerRef}
      />
    );
  }
);

OntologyGraph.displayName = 'OntologyGraph';

export default OntologyGraph;
