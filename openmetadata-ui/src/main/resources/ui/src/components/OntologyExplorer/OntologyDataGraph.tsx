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
import { ChevronDown } from '@untitledui/icons';
import classNames from 'classnames';
import {
  MouseEvent,
  PointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import OntologyControlButtons from './OntologyControlButtons';
import { DATA_MODE_MAX_RENDER_COUNT } from './OntologyExplorer.constants';
import {
  OntologyEdge,
  OntologyGraphData,
  OntologyNode,
} from './OntologyExplorer.interface';
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

interface CardPosition {
  left: number;
  top: number;
}

interface DataClusterModel {
  assetsByTerm: Map<string, OntologyNode[]>;
  terms: OntologyNode[];
}

interface SemanticEdgeLayout {
  edge: OntologyEdge;
  labelLeft: number;
  labelTop: number;
  path: string;
}

const CARD_WIDTH = 236;
const CARD_HEADER_ANCHOR_X = 115;
const CARD_HEADER_ANCHOR_Y = 26;
const EDGE_SLOT_SPACING = 16;
const CANVAS_MIN_HEIGHT = 560;
const CANVAS_MIN_WIDTH = 996;
const COLUMN_COUNT = 3;
const COLUMN_GAP = 74;
const ROW_STEP = 260;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_BUTTON_FACTOR = 1.2;
const WHEEL_ZOOM_STEP = 0.12;
const TOOLBAR_CARD_CLASS =
  'tw:z-6 tw:border tw:border-utility-gray-blue-100 tw:shadow-md';

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}
const START_X = 70;
const START_Y = 50;

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
  const terms = [...termById.values()].filter(
    (term) =>
      (term.assetCount ?? 0) > 0 || (assetsByTerm.get(term.id)?.length ?? 0) > 0
  );

  return { assetsByTerm, terms };
}

function getCardPosition(index: number): CardPosition {
  const column = index % COLUMN_COUNT;
  const row = Math.floor(index / COLUMN_COUNT);

  return {
    left: START_X + column * (CARD_WIDTH + COLUMN_GAP),
    top: START_Y + row * ROW_STEP,
  };
}

function buildSemanticEdgeLayout(
  data: OntologyGraphData,
  positions: Map<string, CardPosition>
): SemanticEdgeLayout[] {
  const relevantEdges = data.edges.filter(
    (edge) => positions.has(edge.from) && positions.has(edge.to)
  );
  const edgeId = (edge: OntologyEdge) =>
    `${edge.from}-${edge.to}-${edge.relationType}`;

  // Fan the edges touching each card across its height so that parallel or
  // converging relations don't overlap on a single anchor point.
  const cardEdgeIds = new Map<string, string[]>();
  relevantEdges.forEach((edge) => {
    const id = edgeId(edge);
    [edge.from, edge.to].forEach((cardId) => {
      const list = cardEdgeIds.get(cardId) ?? [];
      list.push(id);
      cardEdgeIds.set(cardId, list);
    });
  });
  const slotOffset = (cardId: string, id: string): number => {
    const list = cardEdgeIds.get(cardId) ?? [];
    if (list.length <= 1) {
      return 0;
    }

    return (list.indexOf(id) - (list.length - 1) / 2) * EDGE_SLOT_SPACING;
  };

  return relevantEdges.flatMap((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) {
      return [];
    }
    const id = edgeId(edge);

    const x1 = from.left + CARD_HEADER_ANCHOR_X;
    const y1 = from.top + CARD_HEADER_ANCHOR_Y + slotOffset(edge.from, id);
    const x2 = to.left + CARD_HEADER_ANCHOR_X;
    const y2 = to.top + CARD_HEADER_ANCHOR_Y + slotOffset(edge.to, id);
    const middleX = (x1 + x2) / 2;
    const middleY = (y1 + y2) / 2;
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const offset = Math.min(34, distance * 0.16);
    const controlX = middleX - (deltaY / distance) * offset;
    const controlY = middleY + (deltaX / distance) * offset;

    return [
      {
        edge,
        labelLeft: 0.25 * x1 + 0.5 * controlX + 0.25 * x2,
        labelTop: 0.25 * y1 + 0.5 * controlY + 0.25 * y2,
        path: `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`,
      },
    ];
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
  const positionByTermId = useMemo(() => {
    const map = new Map<string, CardPosition>();
    visibleTerms.forEach((term, index) => {
      map.set(term.id, cardPositions[term.id] ?? getCardPosition(index));
    });

    return map;
  }, [visibleTerms, cardPositions]);
  const semanticEdges = useMemo(
    () => buildSemanticEdgeLayout(data, positionByTermId),
    [data, positionByTermId]
  );
  const relationshipTypeByName = useMemo(
    () => new Map(relationTypes.map((type) => [type.name, type])),
    [relationTypes]
  );
  const rows = Math.ceil(visibleTerms.length / COLUMN_COUNT);
  const canvasHeight = Math.max(
    CANVAS_MIN_HEIGHT,
    START_Y + rows * ROW_STEP + (hasMoreTerms ? 64 : 24)
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
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
        element.clientWidth / CANVAS_MIN_WIDTH,
        element.clientHeight / canvasHeight
      )
    );
    setView({
      x: (element.clientWidth - CANVAS_MIN_WIDTH * fitZoom) / 2,
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
    const position = positionByTermId.get(term.id) ?? { left: 0, top: 0 };
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
        className="tw:relative tw:origin-top-left"
        style={{
          height: canvasHeight,
          minWidth: CANVAS_MIN_WIDTH,
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
        }}
        onClick={handleCanvasClick}>
        <svg
          aria-hidden="true"
          className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-visible"
          height={canvasHeight}
          width={CANVAS_MIN_WIDTH}>
          {semanticEdges.map(({ edge, path }, index) => {
            const relationshipType = relationshipTypeByName.get(
              edge.relationType
            );
            const edgeColor =
              getEffectiveRelationColor(edge.relationType, relationshipType) ??
              'var(--color-border-brand)';

            return (
              <path
                d={path}
                data-testid="ontology-data-semantic-edge"
                fill="none"
                key={`${edge.from}-${edge.to}-${edge.relationType}-${index}`}
                opacity="0.85"
                stroke={edgeColor}
                strokeDasharray="6 5"
                strokeWidth="1.8"
              />
            );
          })}
        </svg>

        {semanticEdges.map(({ edge, labelLeft, labelTop }, index) => {
          const relationshipType = relationshipTypeByName.get(
            edge.relationType
          );
          const edgeColor =
            getEffectiveRelationColor(edge.relationType, relationshipType) ??
            'var(--color-border-brand)';

          return (
            <span
              className={classNames(
                'tw:pointer-events-none tw:absolute tw:-translate-x-1/2 tw:-translate-y-1/2',
                'tw:rounded-full tw:border tw:bg-primary tw:px-[7px] tw:py-0.5',
                'tw:font-body tw:text-[9px] tw:leading-normal tw:font-semibold'
              )}
              data-testid="ontology-data-semantic-edge-label"
              key={`${edge.from}-${edge.to}-${edge.relationType}-label-${index}`}
              style={{
                borderColor: edgeColor,
                color: edgeColor,
                left: labelLeft,
                top: labelTop,
              }}>
              {formatRelationLabel(edge.relationType).toLocaleLowerCase()}
            </span>
          );
        })}

        {visibleTerms.map((term, index) => {
          const assets = assetsByTerm.get(term.id) ?? [];
          const position =
            positionByTermId.get(term.id) ?? getCardPosition(index);
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
              <button
                className="tw:mb-[9px] tw:flex tw:w-full tw:items-center tw:gap-[7px] tw:border-0 tw:bg-transparent tw:p-0 tw:text-left"
                type="button"
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
              </button>

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
                    <button
                      className="tw:mb-1.5 tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-[7px] tw:border tw:border-secondary tw:bg-primary tw:px-2 tw:py-1.5 tw:text-left"
                      data-testid={`ontology-data-asset-${asset.id}`}
                      key={asset.id}
                      type="button"
                      onClick={() => onSelectNode(asset)}>
                      {iconUrl ? (
                        <img
                          alt=""
                          className="tw:size-3.5 tw:shrink-0 tw:object-contain"
                          src={iconUrl}
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
                    </button>
                  );
                })}
              </div>

              {remainingAssetCount > 0 || term.isLoadingAssets ? (
                <button
                  className={classNames(
                    'tw:inline-flex tw:items-center tw:gap-1.5 tw:border-0 tw:bg-transparent',
                    'tw:px-0.5 tw:pt-1.5 tw:pb-0.5 tw:font-body tw:text-[10px] tw:leading-normal',
                    'tw:font-semibold tw:text-brand-secondary disabled:tw:cursor-wait disabled:tw:text-disabled'
                  )}
                  data-testid={`ontology-load-more-assets-${term.id}`}
                  disabled={term.isLoadingAssets}
                  type="button"
                  onClick={() => onLoadMore(term)}>
                  <ChevronDown aria-hidden="true" className="tw:size-3" />
                  {term.isLoadingAssets ? (
                    t('label.loading')
                  ) : (
                    <>
                      {t('label.load-more')} ({remainingAssetCount}{' '}
                      {t('label.more-lowercase')})
                    </>
                  )}
                </button>
              ) : null}
            </div>
          );
        })}

        {isRenderCapped ? (
          <span
            className={classNames(
              'tw:absolute tw:left-1/2 tw:-translate-x-1/2 tw:rounded-full tw:border tw:border-secondary',
              'tw:bg-secondary tw:px-3 tw:py-1.5 tw:font-body tw:text-[11px] tw:leading-normal',
              'tw:font-medium tw:text-quaternary'
            )}
            data-testid="ontology-data-render-cap"
            style={{ top: START_Y + rows * ROW_STEP }}>
            {t('message.data-clusters-render-cap', {
              count: DATA_MODE_MAX_RENDER_COUNT,
            })}
          </span>
        ) : hasMoreTerms ? (
          <Button
            className="tw:absolute tw:left-1/2 tw:-translate-x-1/2"
            color="secondary"
            isDisabled={isLoadingMoreTerms}
            size="sm"
            style={{ top: START_Y + rows * ROW_STEP }}
            onPress={onLoadMoreTerms}>
            {isLoadingMoreTerms ? t('label.loading') : t('label.load-more')}
          </Button>
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
