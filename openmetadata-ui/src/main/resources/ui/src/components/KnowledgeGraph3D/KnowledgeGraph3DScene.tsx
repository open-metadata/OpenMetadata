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
import {
  CAMERA_FOCUS_DISTANCE,
  CAMERA_FOCUS_DURATION_MS,
  CHARGE_STRENGTH,
  COVERAGE_DIMMED_OPACITY,
  DIMMED_NODE_OPACITY,
  LABEL_NODE_LIMIT,
  LINK_ONTOLOGY_COLOR,
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
  computeHighlight,
  computeLinkHighlight,
  HighlightSet,
} from './KnowledgeGraph3D.utils';
import { hexRgba, sizeFor } from './nodeCanvas';
import { buildNodeObject, disposeTextureCaches } from './nodeRendering';
import { GraphLink3D, GraphNode3D } from './types';

type SceneNode = NodeObject<GraphNode3D>;
type SceneLink = LinkObject<GraphNode3D, GraphLink3D>;
type SceneGraphMethods = ForceGraphMethods<SceneNode, SceneLink>;

const FRAME_DELAY_MS = 500;
const RESIZE_REFIT_DELAY_MS = 250;
const DIM_LINK_COLOR = hexRgba('#7A8194', 0.07);

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

  return !reducedMotion && link.kind === 'ontology' && active ? 2 : 0;
};

const KnowledgeGraph3DScene: FC<KnowledgeGraph3DSceneProps> = ({
  data,
  level,
  gaps,
  selectedNodeId,
  selectedLinkKey,
  onSelectNode,
  onSelectLink,
  getNodeTooltip,
  getLinkTooltip,
  registerResetView,
  registerExportImage,
}) => {
  const fgRef = useRef<SceneGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFitDoneRef = useRef(false);
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

  const resetView = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) {
      return;
    }
    fg.zoomToFit(ZOOM_TO_FIT_DURATION_MS, ZOOM_TO_FIT_PADDING);
    window.setTimeout(() => {
      const { x, y, z } = fg.camera().position;
      const distance = Math.hypot(x, y, z);
      if (distance > 0 && distance < MIN_CAMERA_DISTANCE) {
        const ratio = MIN_CAMERA_DISTANCE / distance;
        fg.cameraPosition(
          { x: x * ratio, y: y * ratio, z: z * ratio },
          undefined,
          400
        );
      }
    }, ZOOM_TO_FIT_DURATION_MS + 60);
  }, []);

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

  const showLabels = data.nodes.length <= LABEL_NODE_LIMIT;
  const nodeThreeObject = useCallback(
    (node: SceneNode) =>
      buildNodeObject(node as GraphNode3D, {
        level,
        gaps,
        showLabel: showLabels,
      }),
    [level, gaps, showLabels]
  );

  const applyNodeOpacity = useCallback(() => {
    data.nodes.forEach((node) => {
      const object = (node as SceneNode).__threeObj as
        | { traverse: (cb: (child: unknown) => void) => void }
        | undefined;
      if (!object) {
        return;
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
  }, [data.nodes, gaps, highlight]);

  useEffect(() => {
    registerResetView?.(resetView);
    registerExportImage?.(exportImage);
  }, [registerResetView, registerExportImage, resetView, exportImage]);

  useEffect(() => () => disposeTextureCaches(), []);

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

  // Re-fit the camera whenever the stage is resized (e.g. entering or leaving
  // fullscreen) so the graph keeps filling the available space. The first
  // real measurement is skipped because the data-load effect already fits.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (size.width > 0 && size.height > 0) {
      if (initialFitDoneRef.current) {
        const frame = window.setTimeout(resetView, RESIZE_REFIT_DELAY_MS);
        cleanup = () => window.clearTimeout(frame);
      } else {
        initialFitDoneRef.current = true;
      }
    }

    return cleanup;
  }, [size.width, size.height, resetView]);

  useEffect(() => {
    const charge = fgRef.current?.d3Force('charge');
    charge?.strength(CHARGE_STRENGTH);
    const frame = setTimeout(resetView, FRAME_DELAY_MS);

    return () => clearTimeout(frame);
  }, [data, resetView]);

  useEffect(() => {
    let frame = 0;
    let raf = 0;
    const tick = (): void => {
      applyNodeOpacity();
      frame += 1;
      if (frame < OPACITY_APPLY_FRAMES) {
        raf = window.requestAnimationFrame(tick);
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [applyNodeOpacity, level]);

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

  return (
    <div className="tw:absolute tw:inset-0" ref={containerRef}>
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
        onLinkClick={(link: SceneLink) => onSelectLink(link as GraphLink3D)}
        onNodeClick={(node: SceneNode) => onSelectNode(node as GraphNode3D)}
      />
    </div>
  );
};

export default KnowledgeGraph3DScene;
