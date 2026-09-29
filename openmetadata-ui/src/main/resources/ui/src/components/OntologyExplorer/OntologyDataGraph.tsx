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

import { Button, Card } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
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
import { resolveCssColor } from '../../utils/common/cssColor.utils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import OntologyControlButtons from './OntologyControlButtons';
import {
  DATA_MODE_MAX_RENDER_COUNT,
  EDGE_STROKE_COLOR_FALLBACK,
} from './OntologyExplorer.constants';
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
  METRIC_RELATION_TYPE,
} from './utils/graphBuilders';
import {
  formatRelationLabel,
  getEffectiveRelationColor,
} from './utils/graphStyles';
import { getRelationshipHexColor } from './utils/relationshipTypeUtils';

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
  arrowPath: string;
  edge: OntologyEdge;
  labelLeft: number;
  labelTop: number;
  path: string;
  renderKey: string;
}

const CARD_WIDTH = 236;
// Card chrome (padding, border, header) and one compact asset row; the list
// scrolls past ASSET_LIST_MAX_HEIGHT. Used until the rendered card is measured.
const CARD_CHROME_HEIGHT = 55;
const ASSET_ROW_HEIGHT = 44;
const ASSET_LIST_MAX_HEIGHT = 172;
const LOAD_MORE_ASSETS_HEIGHT = 26;
const CANVAS_MIN_HEIGHT = 560;
const CANVAS_MIN_WIDTH = 996;
const LOAD_MORE_TERMS_GAP = 16;
const LOAD_MORE_TERMS_HEIGHT = 48;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_BUTTON_FACTOR = 1.2;
const WHEEL_ZOOM_STEP = 0.12;
const TOOLBAR_CARD_CLASS =
  'tw:z-6 tw:border tw:border-utility-gray-blue-100 tw:shadow-md';

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

function getAssetColumnCount(node: OntologyNode): number | undefined {
  if (node.columnCount !== undefined) {
    return node.columnCount;
  }
  const columnNames = node.searchSource?.columnNames;
  if (Array.isArray(columnNames)) {
    return columnNames.length;
  }

  const columns = node.searchSource?.columns;

  return Array.isArray(columns) ? columns.length : undefined;
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

function estimateCardHeight(term: OntologyNode, loadedAssets: number): number {
  const totalAssets = Math.max(term.assetCount ?? 0, loadedAssets);
  const listHeight = Math.min(
    ASSET_LIST_MAX_HEIGHT,
    loadedAssets * ASSET_ROW_HEIGHT
  );
  const hasMoreAssets = totalAssets > loadedAssets || term.isLoadingAssets;

  return (
    CARD_CHROME_HEIGHT +
    listHeight +
    (hasMoreAssets ? LOAD_MORE_ASSETS_HEIGHT : 0)
  );
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
  const cardHeightOf = useCallback(
    (term: OntologyNode) =>
      measuredHeights[term.id] ??
      estimateCardHeight(term, assetsByTerm.get(term.id)?.length ?? 0),
    [assetsByTerm, measuredHeights]
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
        const effectiveColor =
          getEffectiveRelationColor(
            layout.edge.relationType,
            relationshipType
          ) ?? 'var(--color-border-brand)';
        const color =
          effectiveColor.startsWith('var(') && relationshipType
            ? getRelationshipHexColor(relationshipType)
            : resolveCssColor(effectiveColor, EDGE_STROKE_COLOR_FALLBACK);

        return {
          ...layout,
          color,
        };
      }),
    [dataEdges, relationshipTypeByName]
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
      <div
        className="tw:flex tw:h-full tw:items-center tw:justify-center"
        data-testid="ontology-data-graph-empty">
        <p className="tw:m-0 tw:font-body tw:text-sm tw:text-tertiary">
          {t('message.no-data-available')}
        </p>
      </div>
    );
  }

  const renderLoadMore = (term: OntologyNode, remainingAssetCount: number) =>
    remainingAssetCount > 0 || term.isLoadingAssets ? (
      <Button
        noTextPadding
        className={classNames(
          'tw:inline-flex tw:items-center tw:gap-1.5 tw:border-0 tw:bg-transparent',
          'tw:px-0.5 tw:pt-1.5 tw:pb-0.5 tw:font-body tw:text-[10px] tw:leading-normal',
          'tw:font-semibold tw:text-brand-secondary disabled:tw:cursor-wait disabled:tw:text-disabled tw:*:data-icon:size-3'
        )}
        color="tertiary"
        data-testid={`ontology-load-more-assets-${term.id}`}
        iconLeading={ChevronDown}
        isDisabled={term.isLoadingAssets}
        onClick={() => onLoadMore(term)}>
        {term.isLoadingAssets ? (
          t('label.loading')
        ) : (
          <>
            {t('label.load-more')} ({remainingAssetCount}{' '}
            {t('label.more-lowercase')})
          </>
        )}
      </Button>
    ) : null;

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
            ({ arrowPath, color, path, renderKey }) => (
              <Fragment key={renderKey}>
                <path
                  d={path}
                  data-testid="ontology-data-semantic-edge"
                  fill="none"
                  opacity="0.85"
                  stroke={color}
                  strokeDasharray="6 5"
                  strokeWidth="1.8"
                />
                <path
                  d={arrowPath}
                  data-testid="ontology-data-edge-arrow"
                  fill={color}
                />
              </Fragment>
            )
          )}
        </svg>

        {visibleTerms.map((term) => {
          const assets = assetsByTerm.get(term.id) ?? [];
          const position = cardBoxes.get(term.id) ?? {
            left: CLUSTER_LAYOUT_MARGIN,
            top: CLUSTER_LAYOUT_MARGIN,
          };
          const totalAssetCount = Math.max(term.assetCount ?? 0, assets.length);
          const loadedAssetCount = Math.max(
            term.loadedAssetCount ?? 0,
            assets.length
          );
          const remainingAssetCount = Math.max(
            0,
            totalAssetCount - loadedAssetCount
          );
          const accentColor = term.glossaryId
            ? glossaryColorMap[term.glossaryId]
            : undefined;

          return (
            <div
              className={classNames(
                'tw:absolute tw:cursor-grab tw:rounded-xl tw:border-[1.5px] tw:border-secondary',
                'tw:bg-secondary tw:p-3 tw:shadow-xs active:tw:cursor-grabbing'
              )}
              data-term-id={term.id}
              data-testid={`ontology-data-cluster-${term.id}`}
              key={term.id}
              style={{
                left: position.left,
                top: position.top,
                width: CARD_WIDTH,
              }}
              onClickCapture={handleCardClickCapture}
              onPointerDown={(event) => handleCardPointerDown(event, term)}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerUp}>
              <Button
                noTextPadding
                className={classNames(
                  'tw:mb-[9px] tw:flex tw:w-full tw:items-center tw:gap-[7px] tw:border-0 tw:bg-transparent tw:p-0 tw:text-left',
                  'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:items-center tw:*:data-text:gap-[7px]'
                )}
                color="tertiary"
                onClick={() => onSelectNode(term)}>
                <span
                  aria-hidden="true"
                  className="tw:size-[7px] tw:shrink-0 tw:rounded-full tw:bg-utility-blue-light-400"
                  style={
                    accentColor ? { backgroundColor: accentColor } : undefined
                  }
                />
                <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:text-primary">
                  {term.originalLabel ?? term.label}
                </span>
                <span className="tw:shrink-0 tw:font-body tw:text-[10px] tw:leading-normal tw:font-medium tw:text-quaternary">
                  {totalAssetCount} {t('label.asset-plural-lowercase')}
                </span>
              </Button>

              <div className="tw:-mx-0.5 tw:max-h-[172px] tw:overflow-y-auto tw:px-0.5">
                {assets.map((asset) => {
                  const iconUrl = serviceUtilClassBase.getServiceTypeLogo({
                    entityType: asset.entityRef?.type,
                    serviceType:
                      getText(asset.serviceLabel) ??
                      getText(asset.searchSource?.serviceType),
                  });
                  const columnCount = getAssetColumnCount(asset);

                  return (
                    <Button
                      noTextPadding
                      className={classNames(
                        'tw:mb-1.5 tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-[7px] tw:border tw:border-secondary',
                        'tw:bg-primary tw:px-2 tw:py-1.5 tw:text-left tw:whitespace-normal',
                        'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:items-center tw:*:data-text:gap-2'
                      )}
                      color="tertiary"
                      data-testid={`ontology-data-asset-${asset.id}`}
                      key={asset.id}
                      onClick={() => onSelectNode(asset)}>
                      {iconUrl ? (
                        <img
                          alt=""
                          className="tw:size-3.5 tw:shrink-0 tw:object-contain"
                          height={14}
                          src={iconUrl}
                          width={14}
                        />
                      ) : (
                        <span className="tw:size-3.5 tw:shrink-0 tw:rounded tw:bg-quaternary" />
                      )}
                      <span className="tw:min-w-0 tw:flex-1">
                        <span
                          className="tw:block tw:truncate tw:font-mono tw:text-[11px] tw:leading-normal tw:font-medium tw:text-primary"
                          data-testid="ontology-data-asset-name">
                          {asset.originalLabel ?? asset.label}
                        </span>
                        <span className="tw:block tw:truncate tw:font-body tw:text-[9px] tw:leading-normal tw:font-normal tw:text-quaternary">
                          {getAssetServiceLabel(asset)}
                          {columnCount !== undefined ? (
                            <>
                              {' '}
                              <span aria-hidden="true">·</span> {columnCount}{' '}
                              {t('label.column-lowercase-plural')}
                            </>
                          ) : null}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>

              {renderLoadMore(term, remainingAssetCount)}
            </div>
          );
        })}

        {renderedSemanticEdges.map(
          ({ color, edge, labelLeft, labelTop, renderKey }) => (
            <span
              className={classNames(
                'tw:pointer-events-none tw:absolute tw:-translate-x-1/2 tw:-translate-y-1/2',
                'tw:rounded-full tw:border tw:bg-primary tw:px-[7px] tw:py-0.5',
                'tw:font-body tw:text-[9px] tw:leading-normal tw:font-semibold'
              )}
              data-testid="ontology-data-semantic-edge-label"
              key={`${renderKey}-label`}
              style={{
                borderColor: color,
                color,
                left: labelLeft,
                top: labelTop,
              }}>
              {formatRelationLabel(edge.relationType).toLocaleLowerCase()}
            </span>
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
          <span
            className={classNames(
              'tw:absolute tw:left-1/2 tw:-translate-x-1/2 tw:rounded-full tw:border tw:border-secondary',
              'tw:bg-secondary tw:px-3 tw:py-1.5 tw:font-body tw:text-[11px] tw:leading-normal',
              'tw:font-medium tw:text-quaternary'
            )}
            data-testid="ontology-data-render-cap"
            style={{ top: contentBottom + LOAD_MORE_TERMS_GAP }}>
            {t('message.data-clusters-render-cap', {
              count: DATA_MODE_MAX_RENDER_COUNT,
            })}
          </span>
        ) : null}
      </div>

      <Card
        className={classNames(
          'tw:absolute tw:right-4 tw:bottom-4 tw:flex tw:items-center tw:gap-1 tw:p-1',
          TOOLBAR_CARD_CLASS
        )}
        data-testid="ontology-data-graph-controls">
        <OntologyControlButtons
          isLoading={isLoadingMoreTerms}
          onFitToScreen={fitToScreen}
          onRefresh={resetView}
          onZoomIn={() => zoomAtCenter(ZOOM_BUTTON_FACTOR)}
          onZoomOut={() => zoomAtCenter(1 / ZOOM_BUTTON_FACTOR)}
        />
      </Card>
    </div>
  );
};

export default OntologyDataGraph;
