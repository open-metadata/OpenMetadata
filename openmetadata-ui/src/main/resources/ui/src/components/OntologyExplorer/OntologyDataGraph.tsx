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
  Badge,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  BarChart01,
  ChevronDown,
  ChevronUp,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import {
  Fragment,
  MouseEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import Fqn from '../../utils/Fqn';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import OntologyControlButtons from './OntologyControlButtons';
import { DATA_MODE_MAX_RENDER_COUNT } from './OntologyExplorer.constants';
import {
  OntologyEdge,
  OntologyGraphData,
  OntologyNode,
} from './OntologyExplorer.interface';
import {
  buildClusterEdgeGeometry,
  CardBox,
  CardPosition,
  CLUSTER_LAYOUT_MARGIN,
  KeyedClusterLink,
  layoutDataClusters,
  Point,
} from './utils/dataGraphLayout';
import {
  ASSET_RELATION_TYPE,
  isDataAssetLikeNode,
  isTermNode,
  METRIC_NODE_TYPE,
  METRIC_RELATION_TYPE,
} from './utils/graphBuilders';
import {
  formatRelationLabel,
  getEffectiveRelationColor,
} from './utils/graphStyles';

interface OntologyDataGraphProps {
  data: OntologyGraphData;
  glossaryColorMap: Record<string, string>;
  hasMoreTerms: boolean;
  isLoadingMoreTerms: boolean;
  relationTypes: RelationshipType[];
  onLoadMore: (term: OntologyNode) => void;
  onPaneClick: () => void;
  onSelectNode: (node: OntologyNode) => void;
  onLoadMoreTerms: () => void;
}

interface DataClusterModel {
  assetsByTerm: Map<string, OntologyNode[]>;
  terms: OntologyNode[];
}

interface DataEdgeLayout {
  edge: OntologyEdge;
  end: Point;
  labelLeft: number;
  labelTop: number;
  path: string;
  renderKey: string;
}

const CARD_WIDTH = 380;
// Card border + header and one asset row; used until the rendered card is measured.
const CARD_CHROME_HEIGHT = 50;
const ASSET_ROW_HEIGHT = 64;
const SHOW_MORE_HEIGHT = 41;
// A collapsed card previews this many assets; the rest sit behind "Show N more".
const COLLAPSED_ASSET_COUNT = 3;
const HIERARCHY_RELATION_TYPES = new Set(['parentOf', 'childOf']);
const CANVAS_MIN_HEIGHT = 560;
const CANVAS_MIN_WIDTH = 996;
const LOAD_MORE_TERMS_GAP = 16;
const LOAD_MORE_TERMS_HEIGHT = 48;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_BUTTON_FACTOR = 1.2;
const WHEEL_ZOOM_STEP = 0.12;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function getReferenceName(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return getText(value.displayName) ?? getText(value.name);
}

function getAssetServiceLabel(node: OntologyNode): string {
  if (node.serviceLabel) {
    return node.serviceLabel;
  }
  const searchSource = node.searchSource;
  const serviceLabel =
    getText(searchSource?.serviceType) ??
    getReferenceName(searchSource?.service) ??
    getReferenceName(searchSource?.database);

  return (
    serviceLabel ??
    entityUtilClassBase.getFormattedEntityType(
      node.entityRef?.type ?? node.type
    )
  );
}

function toSentenceCase(label: string): string {
  const lower = label.toLocaleLowerCase();

  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

// The containers above the asset, e.g. "service › database › schema".
function getAssetPath(node: OntologyNode): string {
  const fqn = node.fullyQualifiedName ?? node.entityRef?.fullyQualifiedName;
  const parents = fqn ? Fqn.split(fqn).slice(0, -1) : [];

  return parents.length > 0 ? parents.join(' › ') : getAssetServiceLabel(node);
}

const ASSET_BADGE_COLORS: Record<string, 'indigo' | 'blue-light' | 'purple'> = {
  metric: 'purple',
  table: 'indigo',
  tableColumn: 'blue-light',
};

function getAssetEntityType(node: OntologyNode): string {
  return node.type === METRIC_NODE_TYPE
    ? METRIC_NODE_TYPE
    : node.entityRef?.type ?? node.type;
}

function buildDataClusterModel(data: OntologyGraphData): DataClusterModel {
  const termById = new Map(
    data.nodes.filter(isTermNode).map((node) => [node.id, node])
  );
  const assetById = new Map(
    data.nodes.filter(isDataAssetLikeNode).map((node) => [node.id, node])
  );
  const assetMapsByTerm = new Map<string, Map<string, OntologyNode>>();

  data.edges.forEach((edge) => {
    if (
      edge.relationType !== ASSET_RELATION_TYPE &&
      edge.relationType !== METRIC_RELATION_TYPE
    ) {
      return;
    }

    const term = termById.get(edge.from) ?? termById.get(edge.to);
    const asset = assetById.get(edge.from) ?? assetById.get(edge.to);
    if (!term || !asset) {
      return;
    }

    const assets = assetMapsByTerm.get(term.id) ?? new Map();
    assets.set(asset.id, asset);
    assetMapsByTerm.set(term.id, assets);
  });

  const assetsByTerm = new Map(
    [...assetMapsByTerm].map(([termId, assets]) => [
      termId,
      [...assets.values()],
    ])
  );
  const terms = [...termById.values()]
    .filter(
      (term) =>
        (term.assetCount ?? 0) > 0 ||
        (assetsByTerm.get(term.id)?.length ?? 0) > 0
    )
    .sort(
      (left, right) =>
        Number(Boolean(right.isDataModeSeed)) -
        Number(Boolean(left.isDataModeSeed))
    );

  return { assetsByTerm, terms };
}

function estimateCardHeight(
  term: OntologyNode,
  loadedAssets: number,
  isExpanded: boolean
): number {
  const totalAssets = Math.max(term.assetCount ?? 0, loadedAssets);
  const shownAssets = isExpanded
    ? loadedAssets
    : Math.min(loadedAssets, COLLAPSED_ASSET_COUNT);
  const hasToggle = totalAssets > COLLAPSED_ASSET_COUNT;

  return (
    CARD_CHROME_HEIGHT +
    shownAssets * ASSET_ROW_HEIGHT +
    (hasToggle ? SHOW_MORE_HEIGHT : 0)
  );
}

interface CardAssetState {
  hiddenAssetCount: number;
  shownAssets: OntologyNode[];
  totalAssetCount: number;
  unloadedAssetCount: number;
}

function getCardAssetState(
  term: OntologyNode,
  assets: OntologyNode[],
  isExpanded: boolean
): CardAssetState {
  const totalAssetCount = Math.max(term.assetCount ?? 0, assets.length);
  const loadedAssetCount = Math.max(term.loadedAssetCount ?? 0, assets.length);
  const shownAssets = isExpanded
    ? assets
    : assets.slice(0, COLLAPSED_ASSET_COUNT);

  return {
    hiddenAssetCount: totalAssetCount - shownAssets.length,
    shownAssets,
    totalAssetCount,
    unloadedAssetCount: Math.max(0, totalAssetCount - loadedAssetCount),
  };
}

// Returns `current` itself when nothing changed so React skips the re-render.
function mergeMeasuredHeights(
  current: Record<string, number>,
  entries: ResizeObserverEntry[]
): Record<string, number> {
  const changed = entries.flatMap((entry): Array<[string, number]> => {
    const termId = entry.target.getAttribute('data-term-id');
    const height = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? 0);

    return termId && height > 0 && current[termId] !== height
      ? [[termId, height]]
      : [];
  });

  return changed.length === 0
    ? current
    : { ...current, ...Object.fromEntries(changed) };
}

interface KeyedClusterEdge {
  edge: OntologyEdge;
  renderKey: string;
}

// The Data view shows only the relations between the visible concept cards.
function collectClusterEdges(
  data: OntologyGraphData,
  cardIds: Set<string>
): KeyedClusterEdge[] {
  const relationEdges = data.edges.filter(
    (edge) => cardIds.has(edge.from) && cardIds.has(edge.to)
  );
  const edgeId = (edge: OntologyEdge) =>
    edge.id ??
    `${edge.from}-${edge.to}-${edge.relationType}-${edge.edgeKind ?? ''}`;
  const edgeOccurrences = new Map<string, number>();

  return relationEdges.map((edge) => {
    const id = edgeId(edge);
    const occurrence = edgeOccurrences.get(id) ?? 0;
    edgeOccurrences.set(id, occurrence + 1);

    return {
      edge,
      renderKey: occurrence === 0 ? id : `${id}-${occurrence}`,
    };
  });
}

function toClusterLink({
  edge,
  renderKey,
}: KeyedClusterEdge): KeyedClusterLink {
  return { from: edge.from, key: renderKey, to: edge.to };
}

// A dragged card has left its layout slot, so its links are drawn directly.
function routesBetweenUnmovedCards(
  clusterEdges: KeyedClusterEdge[],
  routes: Map<string, Point[]>,
  movedCards: Record<string, CardPosition>
): Map<string, Point[]> {
  return new Map(
    clusterEdges.flatMap(({ edge, renderKey }): Array<[string, Point[]]> => {
      const route = routes.get(renderKey);
      const isMoved = edge.from in movedCards || edge.to in movedCards;

      return route && !isMoved ? [[renderKey, route]] : [];
    })
  );
}

function buildDataEdgeLayout(
  clusterEdges: KeyedClusterEdge[],
  boxes: Map<string, CardBox>,
  routes: Map<string, Point[]>
): DataEdgeLayout[] {
  const geometry = buildClusterEdgeGeometry(
    clusterEdges.map(toClusterLink),
    boxes,
    routes
  );

  return clusterEdges.flatMap(({ edge, renderKey }) => {
    const route = geometry.get(renderKey);

    return route ? [{ edge, renderKey, ...route }] : [];
  });
}

const OntologyDataGraph = ({
  data,
  glossaryColorMap,
  hasMoreTerms,
  isLoadingMoreTerms,
  relationTypes,
  onLoadMore,
  onPaneClick,
  onSelectNode,
  onLoadMoreTerms,
}: OntologyDataGraphProps) => {
  const { t } = useTranslation();
  const { assetsByTerm, terms } = useMemo(
    () => buildDataClusterModel(data),
    [data]
  );
  const visibleTerms = useMemo(
    () => terms.slice(0, DATA_MODE_MAX_RENDER_COUNT),
    [terms]
  );
  const isRenderCapped = terms.length > visibleTerms.length;
  const [cardPositions, setCardPositions] = useState<
    Record<string, CardPosition>
  >({});
  const [measuredHeights, setMeasuredHeights] = useState<
    Record<string, number>
  >({});
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(
    () => new Set()
  );
  const cardHeightOf = useCallback(
    (term: OntologyNode) =>
      measuredHeights[term.id] ??
      estimateCardHeight(
        term,
        assetsByTerm.get(term.id)?.length ?? 0,
        expandedCardIds.has(term.id)
      ),
    [assetsByTerm, expandedCardIds, measuredHeights]
  );
  const clusterEdges = useMemo(
    () =>
      collectClusterEdges(data, new Set(visibleTerms.map((term) => term.id))),
    [data, visibleTerms]
  );
  const clusterLayout = useMemo(() => {
    const heightById = new Map(
      visibleTerms.map((term) => [term.id, cardHeightOf(term)])
    );

    return layoutDataClusters(
      visibleTerms.map((term) => term.id),
      (id) => ({ height: heightById.get(id) ?? 0, width: CARD_WIDTH }),
      clusterEdges.map(toClusterLink)
    );
  }, [cardHeightOf, clusterEdges, visibleTerms]);
  const cardBoxes = useMemo(() => {
    const boxes = new Map<string, CardBox>();
    visibleTerms.forEach((term) => {
      const position = cardPositions[term.id] ??
        clusterLayout.positions.get(term.id) ?? {
          left: CLUSTER_LAYOUT_MARGIN,
          top: CLUSTER_LAYOUT_MARGIN,
        };
      boxes.set(term.id, {
        ...position,
        height: cardHeightOf(term),
        width: CARD_WIDTH,
      });
    });

    return boxes;
  }, [cardHeightOf, cardPositions, clusterLayout, visibleTerms]);
  const dataEdges = useMemo(
    () =>
      buildDataEdgeLayout(
        clusterEdges,
        cardBoxes,
        routesBetweenUnmovedCards(
          clusterEdges,
          clusterLayout.routes,
          cardPositions
        )
      ),
    [cardBoxes, cardPositions, clusterEdges, clusterLayout]
  );
  const relationshipTypeByName = useMemo(
    () => new Map(relationTypes.map((type) => [type.name, type])),
    [relationTypes]
  );
  const renderedSemanticEdges = useMemo(
    () =>
      dataEdges.map((layout) => {
        const relationshipType = relationshipTypeByName.get(
          layout.edge.relationType
        );
        // DOM/SVG resolves theme variables after a theme switch; a stored palette
        // hex would discard the built-in relation's active foreground.
        const color =
          getEffectiveRelationColor(
            layout.edge.relationType,
            relationshipType
          ) ?? 'var(--tw-color-border-brand)';

        return {
          ...layout,
          color,
          isHierarchy: HIERARCHY_RELATION_TYPES.has(layout.edge.relationType),
        };
      }),
    [dataEdges, relationshipTypeByName]
  );
  const legendEntries = useMemo(
    () => [
      ...new Map(
        renderedSemanticEdges.map(({ color, edge, isHierarchy }) => [
          edge.relationType,
          { color, isHierarchy, relationType: edge.relationType },
        ])
      ).values(),
    ],
    [renderedSemanticEdges]
  );
  const linkedAssetTotal = useMemo(
    () =>
      visibleTerms.reduce(
        (sum, term) =>
          sum +
          Math.max(
            term.assetCount ?? 0,
            assetsByTerm.get(term.id)?.length ?? 0
          ),
        0
      ),
    [assetsByTerm, visibleTerms]
  );
  const contentBottom = useMemo(
    () =>
      Math.max(
        0,
        ...[...cardBoxes.values()].map((box) => box.top + box.height)
      ),
    [cardBoxes]
  );
  const hasFooter = hasMoreTerms || isRenderCapped;
  const { canvasHeight, canvasWidth } = useMemo(() => {
    let nextHeight = Math.max(CANVAS_MIN_HEIGHT, clusterLayout.height);
    let nextWidth = Math.max(CANVAS_MIN_WIDTH, clusterLayout.width);

    cardBoxes.forEach((box) => {
      nextHeight = Math.max(
        nextHeight,
        box.top + box.height + CLUSTER_LAYOUT_MARGIN
      );
      nextWidth = Math.max(
        nextWidth,
        box.left + box.width + CLUSTER_LAYOUT_MARGIN
      );
    });
    if (hasFooter) {
      nextHeight = Math.max(
        nextHeight,
        contentBottom + LOAD_MORE_TERMS_GAP + LOAD_MORE_TERMS_HEIGHT
      );
    }

    return { canvasHeight: nextHeight, canvasWidth: nextWidth };
  }, [cardBoxes, clusterLayout, contentBottom, hasFooter]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardObserverRef = useRef<ResizeObserver | null>(null);
  const fittedLayoutKeyRef = useRef<string>();
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const panRef = useRef<{
    capturing: boolean;
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const didPanRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const cardDragRef = useRef<{
    originLeft: number;
    originTop: number;
    pointerId: number;
    startX: number;
    startY: number;
    termId: string;
  } | null>(null);
  const cardDidDragRef = useRef(false);

  // Callback ref: binds the non-passive wheel listener exactly when the
  // container mounts, so zoom works even if Data mode renders before data loads.
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
    containerRef.current = node;
    if (!node) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      setView((current) => {
        const nextZoom = clampZoom(
          current.zoom *
            (event.deltaY < 0 ? 1 + WHEEL_ZOOM_STEP : 1 - WHEEL_ZOOM_STEP)
        );
        const ratio = nextZoom / current.zoom;

        return {
          x: pointerX - (pointerX - current.x) * ratio,
          y: pointerY - (pointerY - current.y) * ratio,
          zoom: nextZoom,
        };
      });
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    wheelCleanupRef.current = () =>
      node.removeEventListener('wheel', handleWheel);
  }, []);

  // Cards grow with their asset list; lay out and anchor edges on the real size.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) =>
      setMeasuredHeights((current) => mergeMeasuredHeights(current, entries))
    );
    cardObserverRef.current = observer;

    return () => {
      observer.disconnect();
      cardObserverRef.current = null;
    };
  }, []);

  useEffect(() => {
    const observer = cardObserverRef.current;
    canvasRef.current
      ?.querySelectorAll('[data-term-id]')
      .forEach((card) => observer?.observe(card));
  }, [visibleTerms]);

  const layoutKey = useMemo(
    () => visibleTerms.map((term) => term.id).join('|'),
    [visibleTerms]
  );
  // Frame each new set of clusters once; later pans and zooms are the user's.
  useEffect(() => {
    const element = containerRef.current;
    if (
      !element ||
      element.clientWidth === 0 ||
      fittedLayoutKeyRef.current === layoutKey
    ) {
      return;
    }
    fittedLayoutKeyRef.current = layoutKey;
    const fitZoom = Math.min(
      element.clientWidth / canvasWidth,
      element.clientHeight / canvasHeight
    );
    const zoom = clampZoom(Math.min(1, fitZoom));
    setView({
      x: Math.max(0, (element.clientWidth - canvasWidth * zoom) / 2),
      y: Math.max(0, (element.clientHeight - canvasHeight * zoom) / 2),
      zoom,
    });
  }, [canvasHeight, canvasWidth, layoutKey]);

  const zoomAtCenter = (factor: number) => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const centerX = element.clientWidth / 2;
    const centerY = element.clientHeight / 2;
    setView((current) => {
      const nextZoom = clampZoom(current.zoom * factor);
      const ratio = nextZoom / current.zoom;

      return {
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
        zoom: nextZoom,
      };
    });
  };

  const fitToScreen = () => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const fitZoom = clampZoom(
      Math.min(
        element.clientWidth / canvasWidth,
        element.clientHeight / canvasHeight
      )
    );
    setView({
      x: (element.clientWidth - canvasWidth * fitZoom) / 2,
      y: (element.clientHeight - canvasHeight * fitZoom) / 2,
      zoom: fitZoom,
    });
  };

  const resetView = () => setView({ x: 0, y: 0, zoom: 1 });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      (event.target as HTMLElement).closest(
        '[data-testid="ontology-data-graph-controls"]'
      )
    ) {
      return;
    }
    panRef.current = {
      capturing: false,
      originX: view.x,
      originY: view.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    didPanRef.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panRef.current;
    if (!drag) {
      return;
    }
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.capturing && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      drag.capturing = true;
      didPanRef.current = true;
      setIsPanning(true);
      containerRef.current?.setPointerCapture(drag.pointerId);
    }
    if (drag.capturing) {
      setView((current) => ({
        ...current,
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      }));
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panRef.current;
    panRef.current = null;
    if (drag?.capturing) {
      setIsPanning(false);
      containerRef.current?.releasePointerCapture(event.pointerId);
    }
  };

  // A drag that panned must not also fire the underlying card/pane click.
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (didPanRef.current) {
      event.stopPropagation();
      didPanRef.current = false;
    }
  };

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onPaneClick();
    }
  };

  const handleCardPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    term: OntologyNode
  ) => {
    event.stopPropagation();
    const position = cardBoxes.get(term.id) ?? { left: 0, top: 0 };
    cardDragRef.current = {
      originLeft: position.left,
      originTop: position.top,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      termId: term.id,
    };
    cardDidDragRef.current = false;
  };

  const handleCardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = cardDragRef.current;
    if (!drag) {
      return;
    }
    const deltaX = (event.clientX - drag.startX) / view.zoom;
    const deltaY = (event.clientY - drag.startY) / view.zoom;
    if (
      !cardDidDragRef.current &&
      (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)
    ) {
      cardDidDragRef.current = true;
      event.currentTarget.setPointerCapture(drag.pointerId);
    }
    if (cardDidDragRef.current) {
      setCardPositions((prev) => ({
        ...prev,
        [drag.termId]: {
          left: drag.originLeft + deltaX,
          top: drag.originTop + deltaY,
        },
      }));
    }
  };

  const handleCardPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = cardDragRef.current;
    cardDragRef.current = null;
    if (drag && cardDidDragRef.current) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
  };

  // A drag that moved the card must not also fire the header/asset click below it.
  const handleCardClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (cardDidDragRef.current) {
      event.stopPropagation();
      cardDidDragRef.current = false;
    }
  };

  if (terms.length === 0) {
    return (
      <Box
        align="center"
        className="tw:h-full"
        data-testid="ontology-data-graph-empty"
        justify="center">
        <Typography as="p" className="tw:text-tertiary" size="text-sm">
          {t('message.no-data-available')}
        </Typography>
      </Box>
    );
  }

  const toggleCard = (term: OntologyNode, unloadedAssetCount: number) => {
    const isExpanded = expandedCardIds.has(term.id);
    // Expanding past the loaded preview fetches the next page as well.
    if (unloadedAssetCount > 0) {
      onLoadMore(term);
    }
    setExpandedCardIds((current) => {
      const next = new Set(current);
      if (isExpanded && unloadedAssetCount === 0) {
        next.delete(term.id);
      } else {
        next.add(term.id);
      }

      return next;
    });
  };

  const renderAssetRow = (asset: OntologyNode, index: number) => {
    const entityType = getAssetEntityType(asset);
    const isMetric = entityType === METRIC_NODE_TYPE;
    const iconUrl = isMetric
      ? undefined
      : serviceUtilClassBase.getServiceTypeLogo({
          entityType: asset.entityRef?.type,
          serviceType:
            getText(asset.serviceLabel) ??
            getText(asset.searchSource?.serviceType),
        });

    return (
      <Button
        noTextPadding
        className={classNames(
          'tw:flex tw:min-h-16 tw:w-full tw:items-center tw:gap-3 tw:rounded-none tw:px-5 tw:py-3 tw:text-left tw:whitespace-normal',
          'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:items-center tw:*:data-text:gap-3',
          index > 0 && 'tw:border-t tw:border-secondary'
        )}
        color="tertiary"
        data-testid={`ontology-data-asset-${asset.id}`}
        key={asset.id}
        onClick={() => onSelectNode(asset)}>
        <Box
          align="center"
          className={classNames(
            'tw:size-8 tw:shrink-0 tw:rounded-lg tw:border',
            isMetric
              ? 'tw:border-utility-purple-200 tw:bg-utility-purple-50 tw:text-utility-purple-600'
              : 'tw:border-secondary tw:bg-primary'
          )}
          justify="center">
          {isMetric ? <BarChart01 aria-hidden="true" size={20} /> : null}
          {!isMetric && iconUrl ? (
            <img
              alt=""
              className="tw:size-4 tw:object-contain"
              height={16}
              src={iconUrl}
              width={16}
            />
          ) : null}
        </Box>
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Typography
            ellipsis
            className="tw:text-primary"
            data-testid="ontology-data-asset-name"
            size="text-sm"
            weight="medium">
            {asset.originalLabel ?? asset.label}
          </Typography>
          <Typography ellipsis className="tw:text-tertiary" size="text-xs">
            {getAssetPath(asset)}
          </Typography>
        </Box>
        <Badge
          className="tw:shrink-0"
          color={ASSET_BADGE_COLORS[entityType] ?? 'gray'}
          size="sm"
          type="pill-color">
          {entityUtilClassBase.getFormattedEntityType(entityType)}
        </Badge>
      </Button>
    );
  };

  const renderCardToggle = (
    term: OntologyNode,
    { hiddenAssetCount, unloadedAssetCount }: CardAssetState
  ) => {
    const isExpanded = expandedCardIds.has(term.id);
    if (hiddenAssetCount === 0 && !isExpanded && !term.isLoadingAssets) {
      return null;
    }
    const isShowingMore = hiddenAssetCount > 0 || term.isLoadingAssets;
    let label = t('label.show-less');
    if (term.isLoadingAssets) {
      label = t('label.loading');
    } else if (hiddenAssetCount > 0) {
      label = t('label.show-count-more', { count: hiddenAssetCount });
    }

    return (
      <Box className="tw:border-t tw:border-secondary tw:px-5 tw:py-2.5">
        <Button
          color="link-color"
          data-testid={`ontology-load-more-assets-${term.id}`}
          iconLeading={isShowingMore ? ChevronDown : ChevronUp}
          isDisabled={term.isLoadingAssets}
          size="sm"
          onClick={() => toggleCard(term, unloadedAssetCount)}>
          {label}
        </Button>
      </Box>
    );
  };

  const renderCard = (term: OntologyNode) => {
    const assetState = getCardAssetState(
      term,
      assetsByTerm.get(term.id) ?? [],
      expandedCardIds.has(term.id)
    );
    const position = cardBoxes.get(term.id) ?? {
      left: CLUSTER_LAYOUT_MARGIN,
      top: CLUSTER_LAYOUT_MARGIN,
    };
    const accentColor = term.glossaryId
      ? glossaryColorMap[term.glossaryId]
      : undefined;

    return (
      <Card
        className="tw:absolute tw:cursor-grab tw:shadow-xs tw:active:cursor-grabbing"
        data-term-id={term.id}
        data-testid={`ontology-data-cluster-${term.id}`}
        key={term.id}
        style={{ left: position.left, top: position.top, width: CARD_WIDTH }}
        onClickCapture={handleCardClickCapture}
        onPointerDown={(event) => handleCardPointerDown(event, term)}
        onPointerMove={handleCardPointerMove}
        onPointerUp={handleCardPointerUp}>
        <Button
          noTextPadding
          className={classNames(
            'tw:flex tw:min-h-12 tw:w-full tw:items-center tw:rounded-none tw:border-b tw:border-secondary tw:px-5 tw:py-3.5 tw:text-left',
            'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:items-center tw:*:data-text:gap-2'
          )}
          color="tertiary"
          onClick={() => onSelectNode(term)}>
          <span
            aria-hidden="true"
            className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-utility-blue-light-400"
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          />
          <Typography
            ellipsis
            className="tw:min-w-0 tw:text-primary"
            size="text-sm"
            weight="medium">
            {term.originalLabel ?? term.label}
          </Typography>
          <Typography
            className="tw:ml-auto tw:shrink-0 tw:text-tertiary"
            size="text-xs">
            {assetState.totalAssetCount} {t('label.asset-plural-lowercase')}
          </Typography>
        </Button>

        {assetState.shownAssets.map(renderAssetRow)}

        {renderCardToggle(term, assetState)}
      </Card>
    );
  };

  return (
    <div
      className={classNames(
        'tw:relative tw:h-full tw:w-full tw:touch-none tw:overflow-hidden',
        isPanning ? 'tw:cursor-grabbing' : 'tw:cursor-grab'
      )}
      data-testid="ontology-data-graph"
      ref={attachContainer}
      onClickCapture={handleClickCapture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}>
      <div
        aria-label={t('label.graph')}
        className="tw:relative tw:origin-top-left"
        ref={canvasRef}
        role="button"
        style={{
          height: canvasHeight,
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
          width: canvasWidth,
        }}
        tabIndex={0}
        onClick={handleCanvasClick}
        onKeyDown={(event) => {
          if (
            event.key === 'Escape' ||
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            onPaneClick();
          }
        }}>
        <svg
          aria-hidden="true"
          className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-visible"
          height={canvasHeight}
          width={canvasWidth}>
          {renderedSemanticEdges.map(
            ({ color, end, isHierarchy, path, renderKey }) => (
              <Fragment key={renderKey}>
                <path
                  d={path}
                  data-testid="ontology-data-semantic-edge"
                  fill="none"
                  stroke={color}
                  strokeDasharray={isHierarchy ? undefined : '4 3'}
                  strokeWidth="1.5"
                />
                <circle
                  cx={end.x}
                  cy={end.y}
                  data-testid="ontology-data-edge-arrow"
                  fill={color}
                  r="3"
                />
              </Fragment>
            )
          )}
        </svg>

        {visibleTerms.map(renderCard)}

        {renderedSemanticEdges.map(
          ({ color, edge, labelLeft, labelTop, renderKey }) => (
            <Badge
              className="tw:pointer-events-none tw:absolute tw:-translate-x-1/2 tw:-translate-y-1/2 tw:border tw:bg-surface"
              data-testid="ontology-data-semantic-edge-label"
              key={`${renderKey}-label`}
              size="sm"
              style={{
                borderColor: color,
                color,
                left: labelLeft,
                top: labelTop,
              }}
              type="pill-color">
              {formatRelationLabel(edge.relationType).toLocaleLowerCase()}
            </Badge>
          )
        )}

        {hasMoreTerms ? (
          <Button
            className="tw:absolute tw:left-1/2 tw:-translate-x-1/2"
            color="secondary"
            isDisabled={isLoadingMoreTerms}
            size="sm"
            style={{ top: contentBottom + LOAD_MORE_TERMS_GAP }}
            onPress={onLoadMoreTerms}>
            {isLoadingMoreTerms ? t('label.loading') : t('label.load-more')}
          </Button>
        ) : null}

        {!hasMoreTerms && isRenderCapped ? (
          <Badge
            className="tw:absolute tw:left-1/2 tw:-translate-x-1/2"
            color="gray"
            data-testid="ontology-data-render-cap"
            size="md"
            style={{ top: contentBottom + LOAD_MORE_TERMS_GAP }}
            type="pill-color">
            {t('message.data-clusters-render-cap', {
              count: DATA_MODE_MAX_RENDER_COUNT,
            })}
          </Badge>
        ) : null}
      </div>

      <Box
        className="tw:pointer-events-none tw:absolute tw:left-6 tw:top-5"
        data-testid="ontology-data-layer-heading"
        direction="col"
        gap={0}>
        <Typography className="tw:text-primary" size="text-sm" weight="medium">
          {t('label.data-layer')}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.data-layer-summary', {
            assetCount: linkedAssetTotal,
            termCount: visibleTerms.length,
          })}
        </Typography>
      </Box>

      <Box
        align="end"
        className="tw:absolute tw:bottom-4 tw:left-4 tw:z-6"
        gap={2}>
        <Card
          className="tw:flex tw:items-center"
          data-testid="ontology-data-graph-controls"
          variant="elevated">
          <OntologyControlButtons
            isLoading={isLoadingMoreTerms}
            onFitToScreen={fitToScreen}
            onRefresh={resetView}
            onZoomIn={() => zoomAtCenter(ZOOM_BUTTON_FACTOR)}
            onZoomOut={() => zoomAtCenter(1 / ZOOM_BUTTON_FACTOR)}
          />
        </Card>
        {legendEntries.length > 0 ? (
          <Card
            className="tw:flex tw:items-center tw:gap-4 tw:px-3 tw:py-2"
            data-testid="ontology-data-edge-legend"
            variant="elevated">
            {legendEntries.map(({ color, isHierarchy, relationType }) => (
              <Box align="center" gap={2} key={relationType}>
                <svg aria-hidden="true" height="2" width="24">
                  <line
                    stroke={color}
                    strokeDasharray={isHierarchy ? undefined : '4 3'}
                    strokeWidth="2"
                    x1="0"
                    x2="24"
                    y1="1"
                    y2="1"
                  />
                </svg>
                <Typography className="tw:text-secondary" size="text-xs">
                  {toSentenceCase(formatRelationLabel(relationType))}
                </Typography>
              </Box>
            ))}
          </Card>
        ) : null}
      </Box>
    </div>
  );
};

export default OntologyDataGraph;
