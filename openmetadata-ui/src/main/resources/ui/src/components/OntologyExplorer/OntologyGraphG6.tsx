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
import { GraphEvent } from '@antv/g6';
import classNames from 'classnames';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  findOntologyEdgeByGraphId,
  useGraphDataBuilder,
} from './hooks/useGraphData';
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
import PortOverlay from './PortOverlay.component';
import { isHierarchicalRelationship } from './utils/relationshipTypeUtils';

interface GhostNode {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

type OntologyGraphG6Props = OntologyGraphProps & {
  /** A placeholder drawn at a canvas point, e.g. where a new concept is being created. */
  readonly ghostNode?: GhostNode;
};

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
    edgeKind?: string;
    from: string;
    provenance?: string;
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
        ...(e.edgeKind ? { edgeKind: e.edgeKind } : {}),
        ...(e.provenance ? { provenance: e.provenance } : {}),
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

function writeFitViewInProgress(
  container: HTMLDivElement | null,
  isInProgress: boolean
) {
  if (!container) {
    return;
  }
  if (isInProgress) {
    container.dataset.fitViewInProgress = 'true';
  } else {
    delete container.dataset.fitViewInProgress;
  }
}

const OntologyGraph = forwardRef<OntologyGraphHandle, OntologyGraphG6Props>(
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
      conflictEdgeKeys,
      focusNodeId,
      onNodeClick,
      onNodeDoubleClick,
      onPaneClick,
      onCanvasDoubleClick,
      onEdgeClick,
      onScrollNearEdge,
      nodePositions,
      relationTypes,
      relationColors,
      relationTypeGroups,
      canCreateRelationType,
      studioMode,
      keepCanvasOnAdd,
      isAuthoringMode,
      isEditMode,
      onCreateRelation,
      checkRelation,
      ghostNode,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const fitViewSequenceRef = useRef(0);
    const nodeLabels = useMemo(
      () =>
        Object.fromEntries(
          inputNodes.map((node) => [node.id, node.originalLabel ?? node.label])
        ),
      [inputNodes]
    );
    const hierarchicalRelationTypes = useMemo(
      () =>
        new Set(
          (relationTypes ?? [])
            .filter(isHierarchicalRelationship)
            .map((relationType) => relationType.name)
        ),
      [relationTypes]
    );

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
      conflictEdgeKeys,
      isEditMode: Boolean(isAuthoringMode || isEditMode),
      layoutType,
      nodePositions,
      relationTypes,
      relationColors,
      studioMode,
    });

    const { graphRef, extractNodePositions, suppressEdgeCheck } =
      useOntologyGraph({
        containerRef,
        graphData,
        nodePositions,
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
        onCanvasDoubleClick,
        onScrollNearEdge,
        setClickedEdgeId,
        neighborSet,
        glossaryColorMap,
        computeNodeColor,
        assetToTermMap,
        hierarchicalRelationTypes,
        isEditMode,
        studioMode,
        keepCanvasOnAdd,
      });

    useImperativeHandle(
      ref,
      () => ({
        fitView: async () => {
          const graph = graphRef.current;
          if (!graph) {
            return;
          }
          const sequence = ++fitViewSequenceRef.current;
          suppressEdgeCheck(800);
          writeFitViewInProgress(containerRef.current, true);
          try {
            await fitViewWithMinZoom(graph, 300);
          } finally {
            if (fitViewSequenceRef.current === sequence) {
              writeFitViewInProgress(containerRef.current, false);
            }
          }
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
        clearEdgeSelection: () => setClickedEdgeId(null),
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
      const selectedEdge = findOntologyEdgeByGraphId(
        mergedEdgesList,
        clickedEdgeId
      );
      onEdgeClick?.(selectedEdge);
    }, [clickedEdgeId, mergedEdgesList, onEdgeClick]);

    useEffect(() => {
      writeCardinalityMap(containerRef.current, cardinalityLabelMap);
    }, [cardinalityLabelMap]);

    const [ghostAt, setGhostAt] = useState<{ x: number; y: number }>();
    // Follows pan and zoom, since the ghost is a DOM element over the canvas.
    useEffect(() => {
      const graph = graphRef.current;
      if (!ghostNode || !graph) {
        setGhostAt(undefined);

        return undefined;
      }
      const place = () => {
        const [x, y] = graph.getViewportByCanvas([ghostNode.x, ghostNode.y]);
        setGhostAt({ x, y });
      };
      place();
      graph.on(GraphEvent.AFTER_TRANSFORM, place);

      return () => {
        graph.off(GraphEvent.AFTER_TRANSFORM, place);
      };
    }, [ghostNode, graphRef]);

    return (
      <div className="tw:relative tw:h-full tw:w-full">
        <div
          className="tw:w-full tw:h-full tw:relative ontology-g6-container"
          ref={containerRef}
        />
        {ghostNode && ghostAt ? (
          <div
            aria-hidden="true"
            className={classNames(
              'tw:pointer-events-none tw:absolute tw:z-5 tw:-translate-x-1/2 tw:-translate-y-1/2',
              'tw:rounded-lg tw:border tw:border-dashed tw:border-brand tw:bg-brand-primary tw:px-4 tw:py-2',
              'tw:font-body tw:text-sm tw:font-medium tw:text-brand-secondary'
            )}
            data-testid="ontology-ghost-node"
            style={{ left: ghostAt.x, top: ghostAt.y }}>
            {ghostNode.label}
          </div>
        ) : null}
        <PortOverlay
          canCreateRelationType={canCreateRelationType}
          checkRelation={checkRelation}
          containerRef={containerRef}
          isEditMode={Boolean(isEditMode)}
          nodeLabels={nodeLabels}
          relationTypeGroups={relationTypeGroups}
          onCreateRelation={onCreateRelation ?? (() => Promise.resolve())}
        />
      </div>
    );
  }
);

OntologyGraph.displayName = 'OntologyGraph';

export default OntologyGraph;
