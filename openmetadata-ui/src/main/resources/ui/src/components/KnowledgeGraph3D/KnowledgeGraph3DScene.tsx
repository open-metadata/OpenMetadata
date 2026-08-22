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
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ForceGraph3D, {
  ForceGraphMethods,
  LinkObject,
  NodeObject,
} from 'react-force-graph-3d';
import type { Object3D } from 'three';
import {
  CAMERA_FOCUS_DISTANCE,
  CAMERA_FOCUS_DURATION_MS,
  CHARGE_STRENGTH,
  COVERAGE_DIMMED_OPACITY,
  DIMMED_NODE_OPACITY,
  LABEL_RENDER_LIMIT,
  LINK_DISTANCE,
  LINK_ONTOLOGY_COLOR,
  LINK_STRENGTH,
  LINK_TECHNICAL_COLOR,
  MIN_CAMERA_DISTANCE,
  ONTOLOGY_PARTICLE_COLOR,
  OPACITY_APPLY_FRAMES,
  SIMULATION_COOLDOWN_TICKS,
  SIMULATION_COOLDOWN_TIME_MS,
  ZOOM_TO_FIT_DURATION_MS,
  ZOOM_TO_FIT_PADDING,
} from './KnowledgeGraph3D.constants';
import { KnowledgeGraph3DSceneProps } from './KnowledgeGraph3D.interface';
import {
  canFitGraph,
  computeHighlight,
  computeLinkHighlight,
  expandGraphLayout,
  getCameraRecoveryPosition,
  getVisibleLabelIds,
  HighlightSet,
} from './KnowledgeGraph3D.utils';
import { hexRgba, sizeFor } from './nodeCanvas';
import {
  buildNodeObject,
  disposeTextureCaches,
  NODE_LABEL_OBJECT_NAME,
} from './nodeRendering';
import { GraphLink3D, GraphNode3D } from './types';

type SceneNode = NodeObject<GraphNode3D>;
type SceneLink = LinkObject<GraphNode3D, GraphLink3D>;
type SceneGraphMethods = ForceGraphMethods<SceneNode, SceneLink>;

const DIM_LINK_COLOR = hexRgba('#7A8194', 0.07);
const GRAPH_ORIGIN = { x: 0, y: 0, z: 0 };

const sceneNodeId = (node: SceneNode | null): string | null =>
  node?.id ? String(node.id) : null;

const setNodeLabelVisibility = (
  node: SceneNode | null,
  visible: boolean
): void => {
  const object = node?.__threeObj as Object3D | undefined;
  const label = object?.getObjectByName(NODE_LABEL_OBJECT_NAME);
  if (label) {
    label.visible = visible;
  }
};

const nodeOpacityFor = (
  node: GraphNode3D,
  gaps: boolean,
  highlight: HighlightSet | null
): number => {
  let opacity = 1;
  if (gaps) {
    opacity =
      node.type === 'table' && !node.mapped ? 1 : COVERAGE_DIMMED_OPACITY;
  } else if (highlight && !highlight.nodes.has(node.id)) {
    opacity = DIMMED_NODE_OPACITY;
  }

  return opacity;
};

const baseLinkColor = (link: GraphLink3D): string =>
  link.kind === 'ontology' ? LINK_ONTOLOGY_COLOR : LINK_TECHNICAL_COLOR;

const linkColorFor = (
  link: GraphLink3D,
  highlight: HighlightSet | null
): string => {
  let color = hexRgba(baseLinkColor(link), 0.5);
  if (highlight) {
    color = highlight.links.has(link)
      ? hexRgba(baseLinkColor(link), 0.95)
      : DIM_LINK_COLOR;
  }

  return color;
};

const linkWidthFor = (
  link: GraphLink3D,
  highlight: HighlightSet | null
): number => {
  let width = link.kind === 'ontology' ? 0.8 : 1.2;
  if (link.derived) {
    width = 1.7;
  }
  if (highlight && highlight.links.has(link)) {
    width = 2.4;
  }

  return width;
};

const linkParticlesFor = (
  link: GraphLink3D,
  highlight: HighlightSet | null,
  reducedMotion: boolean
): number => {
  const active = Boolean(highlight && highlight.links.has(link));
  // Derived ontology edges always animate so they read as semantic (not
  // technical) links; other ontology edges animate only while highlighted.
  const animated = link.derived || (link.kind === 'ontology' && active);

  return !reducedMotion && animated ? 2 : 0;
};

const KnowledgeGraph3DScene: FC<KnowledgeGraph3DSceneProps> = ({
  data,
  focusNodeId,
  level,
  gaps,
  selectedNodeId,
  selectedLinkKey,
  onSelectNode,
  onSelectLink,
  getNodeTooltip,
  getLinkTooltip,
  isFullscreen,
  registerResetView,
  registerExportImage,
}) => {
  const fgRef = useRef<SceneGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const refitPendingRef = useRef(false);
  const fitPendingRef = useRef(true);
  const settledFitPendingRef = useRef(true);
  const layoutExpandedRef = useRef(false);
  const forcesConfiguredRef = useRef(false);
  const simulationReadyRef = useRef(false);
  const cameraGuardTimerRef = useRef(0);
  const hoveredNodeRef = useRef<SceneNode | null>(null);
  const pendingHoveredNodeRef = useRef<SceneNode | null>(null);
  const hoverFrameRef = useRef(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    []
  );

  const highlight = useMemo<HighlightSet | null>(() => {
    let result: HighlightSet | null = null;
    if (selectedLinkKey) {
      result = computeLinkHighlight(data.links, selectedLinkKey);
    } else if (selectedNodeId) {
      result = computeHighlight(data.links, selectedNodeId);
    }

    return result;
  }, [data.links, selectedNodeId, selectedLinkKey]);

  const visibleLabelIds = useMemo(
    () => getVisibleLabelIds(data, focusNodeId, selectedNodeId),
    [data, focusNodeId, selectedNodeId]
  );

  const guardCamera = useCallback((transitionDuration = 0): void => {
    const graph = fgRef.current;
    const recovery = graph
      ? getCameraRecoveryPosition(graph.camera().position, MIN_CAMERA_DISTANCE)
      : null;
    if (graph && recovery) {
      graph.cameraPosition(recovery, GRAPH_ORIGIN, transitionDuration);
    }
  }, []);

  const scheduleCameraGuard = useCallback((): void => {
    window.clearTimeout(cameraGuardTimerRef.current);
    cameraGuardTimerRef.current = window.setTimeout(() => {
      guardCamera(300);
    }, ZOOM_TO_FIT_DURATION_MS + 60);
  }, [guardCamera]);

  const fitGraph = useCallback((): boolean => {
    const graph = fgRef.current;
    const isReady = Boolean(
      graph &&
        canFitGraph(data.nodes, size.width, size.height, ZOOM_TO_FIT_PADDING)
    );
    if (graph && isReady) {
      guardCamera();
      graph.zoomToFit(ZOOM_TO_FIT_DURATION_MS, ZOOM_TO_FIT_PADDING);
      scheduleCameraGuard();
    }

    return isReady;
  }, [data.nodes, guardCamera, scheduleCameraGuard, size.height, size.width]);

  const resetView = useCallback(() => {
    fitPendingRef.current = !fitGraph();
  }, [fitGraph]);

  const exportImage = useCallback(async (): Promise<string | null> => {
    let result: string | null = null;
    try {
      const renderer = fgRef.current?.renderer();
      fgRef.current?.refresh();
      // toDataURL throws on a tainted/lost context — never let that reject the
      // export click handler; surface a toast via the null return instead.
      result = renderer ? renderer.domElement.toDataURL('image/png') : null;
    } catch {
      result = null;
    }

    return result;
  }, []);

  const renderLabels = data.nodes.length <= LABEL_RENDER_LIMIT;
  const nodeThreeObject = useCallback(
    (node: SceneNode) =>
      buildNodeObject(node as GraphNode3D, {
        level,
        gaps,
        showLabel: renderLabels,
      }),
    [level, gaps, renderLabels]
  );

  const handleNodeHover = useCallback(
    (node: SceneNode | null) => {
      if (!renderLabels) {
        return;
      }

      const queuedNode = hoverFrameRef.current
        ? pendingHoveredNodeRef.current
        : hoveredNodeRef.current;
      if (sceneNodeId(queuedNode) === sceneNodeId(node)) {
        return;
      }

      pendingHoveredNodeRef.current = node;
      window.cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = window.requestAnimationFrame(() => {
        const previousNode = hoveredNodeRef.current;
        const nextNode = pendingHoveredNodeRef.current;
        const previousNodeId = sceneNodeId(previousNode);
        const nextNodeId = sceneNodeId(nextNode);

        if (
          previousNodeId &&
          previousNodeId !== nextNodeId &&
          !visibleLabelIds.has(previousNodeId)
        ) {
          setNodeLabelVisibility(previousNode, false);
        }
        if (nextNodeId) {
          setNodeLabelVisibility(nextNode, true);
        }

        hoveredNodeRef.current = nextNode;
        pendingHoveredNodeRef.current = null;
        hoverFrameRef.current = 0;
        fgRef.current?.refresh();
      });
    },
    [renderLabels, visibleLabelIds]
  );

  const applyNodePresentation = useCallback(() => {
    const hoveredNodeId = sceneNodeId(hoveredNodeRef.current);
    data.nodes.forEach((node) => {
      const object = (node as SceneNode).__threeObj as Object3D | undefined;
      if (!object) {
        return;
      }
      const label = object.getObjectByName(NODE_LABEL_OBJECT_NAME);
      if (label) {
        label.visible =
          visibleLabelIds.has(node.id) || hoveredNodeId === node.id;
      }
      const opacity = nodeOpacityFor(node, gaps, highlight);
      object.traverse((child) => {
        const material = (
          child as { material?: { opacity?: number; transparent?: boolean } }
        ).material;
        if (material && material.opacity !== undefined) {
          material.transparent = true;
          material.opacity = opacity;
        }
      });
    });
  }, [data.nodes, gaps, highlight, visibleLabelIds]);

  useEffect(() => {
    registerResetView?.(resetView);
    registerExportImage?.(exportImage);
  }, [registerResetView, registerExportImage, resetView, exportImage]);

  useEffect(
    () => () => {
      window.clearTimeout(cameraGuardTimerRef.current);
      window.cancelAnimationFrame(hoverFrameRef.current);
      disposeTextureCaches();
    },
    []
  );

  useEffect(() => {
    window.cancelAnimationFrame(hoverFrameRef.current);
    hoveredNodeRef.current = null;
    pendingHoveredNodeRef.current = null;
    hoverFrameRef.current = 0;
  }, [data]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }
    const measure = (): void =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Arm a re-fit when fullscreen is toggled. The fit itself runs below, once
  // the stage has actually resized, so it never fits against stale dimensions.
  // The first render is skipped because the data-load effect already fits.
  useEffect(() => {
    if (didMountRef.current) {
      refitPendingRef.current = true;
    } else {
      didMountRef.current = true;
    }
  }, [isFullscreen]);

  // Run the armed re-fit once the ResizeObserver reports the new stage size, so
  // the graph fills it. Plain window resizes (no pending toggle) are ignored,
  // preserving any manual zoom/pan.
  useEffect(() => {
    let raf = 0;
    if (refitPendingRef.current && size.width > 0 && size.height > 0) {
      refitPendingRef.current = false;
      raf = window.requestAnimationFrame(resetView);
    }

    return () => window.cancelAnimationFrame(raf);
  }, [size.width, size.height, resetView]);

  useEffect(() => {
    fitPendingRef.current = true;
    settledFitPendingRef.current = true;
    layoutExpandedRef.current = false;
    forcesConfiguredRef.current = false;
    if (simulationReadyRef.current) {
      fgRef.current?.d3ReheatSimulation();
    }
  }, [data]);

  const configureForces = useCallback((): boolean => {
    const graph = fgRef.current;
    const charge = graph?.d3Force('charge');
    const link = graph?.d3Force('link');
    charge?.strength(CHARGE_STRENGTH);
    link?.distance(LINK_DISTANCE).strength(LINK_STRENGTH);

    return Boolean(graph);
  }, []);

  const handleEngineTick = useCallback(() => {
    simulationReadyRef.current = true;
    if (!forcesConfiguredRef.current) {
      forcesConfiguredRef.current = configureForces();
    }
    if (fitPendingRef.current && fitGraph()) {
      fitPendingRef.current = false;
    }
  }, [configureForces, fitGraph]);

  const handleEngineStop = useCallback(() => {
    if (settledFitPendingRef.current) {
      settledFitPendingRef.current = false;
      if (!layoutExpandedRef.current) {
        layoutExpandedRef.current = true;
        expandGraphLayout(data.nodes, size.width, size.height);
        fgRef.current?.refresh();
      }
      fitPendingRef.current = !fitGraph();
    }
  }, [data.nodes, fitGraph, size.height, size.width]);

  useEffect(() => {
    let frame = 0;
    let raf = 0;
    const tick = (): void => {
      applyNodePresentation();
      frame += 1;
      if (frame < OPACITY_APPLY_FRAMES) {
        raf = window.requestAnimationFrame(tick);
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [applyNodePresentation, level]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const node = data.nodes.find((item) => item.id === selectedNodeId) as
      | SceneNode
      | undefined;
    if (!node || node.x === undefined) {
      return;
    }
    const distance = Math.hypot(node.x, node.y ?? 0, node.z ?? 0) || 1;
    const ratio = 1 + CAMERA_FOCUS_DISTANCE / distance;
    fgRef.current?.cameraPosition(
      { x: node.x * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio },
      { x: node.x, y: node.y ?? 0, z: node.z ?? 0 },
      CAMERA_FOCUS_DURATION_MS
    );
  }, [selectedNodeId, data.nodes]);

  const linkColor = useCallback(
    (link: SceneLink) => linkColorFor(link as GraphLink3D, highlight),
    [highlight]
  );
  const linkWidth = useCallback(
    (link: SceneLink) => linkWidthFor(link as GraphLink3D, highlight),
    [highlight]
  );
  const linkParticles = useCallback(
    (link: SceneLink) =>
      linkParticlesFor(link as GraphLink3D, highlight, reducedMotion),
    [highlight, reducedMotion]
  );
  const hasMeasuredViewport = size.width > 0 && size.height > 0;

  return (
    <div className="tw:absolute tw:inset-0" ref={containerRef}>
      {hasMeasuredViewport && (
        <ForceGraph3D
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={SIMULATION_COOLDOWN_TICKS}
          cooldownTime={SIMULATION_COOLDOWN_TIME_MS}
          graphData={data}
          height={size.height}
          linkColor={linkColor}
          linkCurvature={(link: SceneLink) =>
            (link as GraphLink3D).kind === 'ontology' ? 0.2 : 0
          }
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticleColor={() => ONTOLOGY_PARTICLE_COLOR}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalParticles={linkParticles}
          linkLabel={(link: SceneLink) => getLinkTooltip(link as GraphLink3D)}
          linkOpacity={1}
          linkWidth={linkWidth}
          nodeLabel={(node: SceneNode) => getNodeTooltip(node as GraphNode3D)}
          nodeOpacity={0.95}
          nodeRelSize={4}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          nodeVal={(node: SceneNode) =>
            Math.cbrt(sizeFor((node as GraphNode3D).type)) * 2
          }
          ref={fgRef}
          rendererConfig={{
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
          }}
          showNavInfo={false}
          width={size.width}
          onBackgroundClick={() => onSelectNode(null)}
          onEngineStop={handleEngineStop}
          onEngineTick={handleEngineTick}
          onLinkClick={(link: SceneLink) => onSelectLink(link as GraphLink3D)}
          onNodeClick={(node: SceneNode) => onSelectNode(node as GraphNode3D)}
          onNodeHover={handleNodeHover}
        />
      )}
    </div>
  );
};

export default KnowledgeGraph3DScene;
