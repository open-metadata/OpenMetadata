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
  ButtonUtility,
  Dropdown,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns03,
  Database01,
  DotsHorizontal,
  LinkExternal01,
  Plus,
  Table,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import {
  FC,
  MouseEvent,
  PointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { AssetBinding } from '../../generated/type/ontologyConceptBindingsResponse';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { AssetUnlinkConfirm } from '../governance/ontology/OntologyGraphView/OntologyDataAssetPanel';
import OntologyControlButtons from './OntologyControlButtons';
import { DataEdgeLegend, LegendEntry } from './OntologyDataGraphChrome';
import { BoundColumn, OntologyNode } from './OntologyExplorer.interface';
import {
  columnNodeKey,
  ColumnSlot,
  layoutColumnNodes,
} from './utils/dataColumnLayout';
import {
  CardBox,
  layoutSourceGroups,
  rightSideLoop,
  sideCurve,
  SOURCE_GROUP_HEADER_HEIGHT,
} from './utils/dataGraphLayout';

/** The asset actions of the card menu; without it, the menu offers only Open asset. */
export interface NativeAssetMenu {
  canUnlink: boolean;
  conceptName: string;
  getBinding: (asset: OntologyNode) => AssetBinding | undefined;
  onOpenAsset: (asset: OntologyNode) => void;
  onUnlink: (binding: AssetBinding) => Promise<boolean>;
}

export interface AssetLineagePair {
  from: string;
  to: string;
}

interface OntologyNativeDataCanvasProps {
  assets: OntologyNode[];
  concept: OntologyNode;
  isConceptSelected: boolean;
  lineage: AssetLineagePair[];
  menu: NativeAssetMenu;
  selectedAssetNodeId?: string;
  selectedColumnKey?: string;
  /** Present when the person may link assets to the concept. */
  onLinkData?: () => void;
  onLoadMore: () => void;
  onPaneClick: () => void;
  onSelectAsset: (asset: OntologyNode) => void;
  onSelectColumn: (asset: OntologyNode, column: BoundColumn) => void;
  onSelectConcept: () => void;
}

interface SourceGroup {
  assets: OntologyNode[];
  key: string;
  serviceType?: string;
}

// A collapsed concept shows this many assets; "Load more" reveals the rest.
export const NATIVE_COLLAPSED_ASSET_COUNT = 6;
const ASSET_EDGE_COLOR = 'var(--tw-color-border-primary)';
const ACTIVE_EDGE_COLOR = 'var(--tw-color-border-brand)';
const COLUMN_EDGE_COLOR = 'var(--tw-color-border-brand)';
const LINEAGE_EDGE_COLOR = 'var(--tw-color-fg-secondary)';
const FOOTER_GAP = 4;
const FOOTER_ROW_HEIGHT = 40;
// Clear of the concept chip pinned over the canvas top-left.
const INITIAL_VIEW = { x: 0, y: 72, zoom: 1 };
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_BUTTON_FACTOR = 1.2;
const WHEEL_ZOOM_STEP = 0.12;
const PAN_THRESHOLD = 3;
const UNKNOWN_SOURCE = '';

const clampZoom = (value: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

function toggled(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  if (!next.delete(id)) {
    next.add(id);
  }

  return next;
}

function describeLineage(asset: OntologyNode, t: TFunction): string[] {
  return (asset.lineageNotes ?? []).map(({ direction, label }) =>
    direction === 'downstream'
      ? t('message.lineage-to-table', { name: label })
      : t('message.lineage-from-table', { name: label })
  );
}

function buildLegend(
  t: TFunction,
  hasLineage: boolean,
  hasBoundColumns: boolean
): LegendEntry[] {
  return [
    {
      color: ASSET_EDGE_COLOR,
      isSolid: true,
      key: 'asset-binding',
      label: t('label.ontology-asset-binding'),
    },
    ...(hasLineage
      ? [
          {
            color: LINEAGE_EDGE_COLOR,
            isSolid: true,
            key: 'lineage',
            label: t('label.observed-lineage'),
          },
        ]
      : []),
    ...(hasBoundColumns
      ? [
          {
            color: COLUMN_EDGE_COLOR,
            isSolid: false,
            key: 'column-binding',
            label: t('label.ontology-column-binding'),
          },
        ]
      : []),
  ];
}

const TYPE_ICONS: Record<string, FC<{ className?: string }>> = {
  [EntityType.TABLE]: Table,
  [EntityType.TOPIC]: Activity,
};

const typeIconOf = (entityType: string) => TYPE_ICONS[entityType] ?? Database01;

function groupBySource(assets: OntologyNode[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  assets.forEach((asset) => {
    const key = asset.serviceLabel ?? UNKNOWN_SOURCE;
    const group = groups.get(key) ?? {
      assets: [],
      key,
      serviceType: asset.serviceLabel,
    };
    group.assets.push(asset);
    groups.set(key, group);
  });

  // Named sources alphabetically, the unnamed one last.
  return [...groups.values()].sort(
    (left, right) =>
      Number(left.key === UNKNOWN_SOURCE) -
        Number(right.key === UNKNOWN_SOURCE) ||
      left.key.localeCompare(right.key)
  );
}

function ServiceBadge({ serviceType }: { serviceType?: string }) {
  const logo = serviceType
    ? serviceUtilClassBase.getServiceTypeLogo({ serviceType })
    : undefined;

  return (
    <span className="tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center tw:rounded tw:border tw:border-secondary tw:bg-surface">
      {logo ? (
        <img
          alt=""
          className="tw:size-3.5 tw:object-contain"
          height={14}
          src={logo}
          width={14}
        />
      ) : (
        <Database01
          aria-hidden="true"
          className="tw:size-3 tw:text-fg-quaternary"
        />
      )}
    </span>
  );
}

interface AssetCardMenuProps {
  asset: OntologyNode;
  menu: NativeAssetMenu;
}

function AssetCardMenu({ asset, menu }: AssetCardMenuProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const binding = menu.canUnlink ? menu.getBinding(asset) : undefined;

  return (
    <>
      <Dropdown.Root>
        <ButtonUtility
          aria-label={t('label.more-actions-for', { name: asset.label })}
          color="tertiary"
          data-testid={`ontology-data-asset-menu-${asset.id}`}
          icon={DotsHorizontal}
          ref={triggerRef}
          size="xs"
        />
        <Dropdown.Popover className="tw:w-44">
          <Dropdown.Menu
            aria-label={t('label.action-plural')}
            selectionMode="none"
            onAction={(key) =>
              key === 'unlink' ? setIsConfirming(true) : menu.onOpenAsset(asset)
            }>
            <Dropdown.Item
              data-testid="ontology-data-asset-menu-open"
              icon={LinkExternal01}
              id="open"
              label={t('label.open-asset')}
            />
            {binding ? (
              <Dropdown.Item
                data-testid="ontology-data-asset-menu-unlink"
                icon={Trash01}
                id="unlink"
                label={t('label.unlink')}
              />
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      {binding ? (
        <AssetUnlinkConfirm
          assetName={asset.label}
          binding={binding}
          conceptName={menu.conceptName}
          isOpen={isConfirming}
          triggerRef={triggerRef}
          onOpenChange={setIsConfirming}
          onUnlink={menu.onUnlink}
        />
      ) : null}
    </>
  );
}

interface AssetCardProps {
  asset: OntologyNode;
  box: CardBox;
  isColumnsOpen: boolean;
  isSelected: boolean;
  menu: NativeAssetMenu;
  onHover: (assetId?: string) => void;
  onSelect: (asset: OntologyNode) => void;
  onToggleColumns: (asset: OntologyNode) => void;
}

function AssetCard({
  asset,
  box,
  isColumnsOpen,
  isSelected,
  menu,
  onHover,
  onSelect,
  onToggleColumns,
}: AssetCardProps) {
  const { t } = useTranslation();
  const entityType = asset.entityRef?.type ?? asset.type;
  const TypeIcon = typeIconOf(entityType);
  const boundCount = asset.boundColumns?.length ?? 0;
  const subtitle = [
    asset.serviceLabel,
    entityUtilClassBase.getFormattedEntityType(entityType),
  ]
    .filter(Boolean)
    .join(' · ');
  const lineageId = `ontology-data-asset-lineage-${asset.id}`;
  const lineageNotes = describeLineage(asset, t);
  const tooltip = asset.fullyQualifiedName ?? asset.label;

  return (
    <div
      className={classNames(
        'tw:absolute tw:flex tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:bg-surface tw:pr-2 tw:shadow-xs',
        isSelected
          ? 'tw:border-brand tw:outline-3 tw:outline-utility-blue-100'
          : 'tw:border-secondary'
      )}
      data-testid={`ontology-data-asset-card-${asset.id}`}
      style={box}>
      <Tooltip placement="top start" title={tooltip}>
        {/* ADR:2026-10-30-data-mode-asset-rows-are-styled-at-the-call-site-until-core-ships-a-list-row-button */}
        <Button
          noTextPadding
          aria-describedby={lineageNotes.length > 0 ? lineageId : undefined}
          className={classNames(
            'tw:flex tw:h-full tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3 tw:rounded-lg tw:py-2 tw:pl-2.5 tw:text-left',
            'tw:*:data-text:flex tw:*:data-text:min-w-0 tw:*:data-text:w-full tw:*:data-text:items-center tw:*:data-text:gap-3'
          )}
          color="tertiary"
          data-testid={`ontology-data-asset-${asset.id}`}
          onBlur={() => onHover(undefined)}
          onClick={() => onSelect(asset)}
          onFocus={() => onHover(asset.id)}
          onMouseEnter={() => onHover(asset.id)}
          onMouseLeave={() => onHover(undefined)}>
          <span className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:bg-utility-blue-50 tw:text-utility-blue-600">
            <TypeIcon aria-hidden="true" className="tw:size-4" />
          </span>
          <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
            <Typography
              ellipsis
              className="tw:text-primary"
              data-testid="ontology-data-asset-name"
              size="text-sm"
              weight="semibold">
              {asset.originalLabel ?? asset.label}
            </Typography>
            <Typography ellipsis color="secondary" size="text-xs">
              {subtitle}
            </Typography>
          </span>
        </Button>
      </Tooltip>
      {lineageNotes.length > 0 ? (
        <span hidden id={lineageId}>
          {lineageNotes.join(' · ')}
        </span>
      ) : null}
      {boundCount > 0 ? (
        <Button
          aria-expanded={isColumnsOpen}
          className="tw:shrink-0"
          color="link-color"
          data-testid={`ontology-data-asset-columns-toggle-${asset.id}`}
          iconTrailing={isColumnsOpen ? ChevronDown : ChevronRight}
          size="xs"
          onPress={() => onToggleColumns(asset)}>
          {t('label.ontology-column-count', { count: boundCount })}
        </Button>
      ) : (
        <Badge className="tw:shrink-0" color="gray" size="sm" type="pill-color">
          {t('label.ontology-column-count', { count: 0 })}
        </Badge>
      )}
      <AssetCardMenu asset={asset} menu={menu} />
    </div>
  );
}

interface RootNodeProps {
  box: CardBox;
  concept: OntologyNode;
  isSelected: boolean;
  totalCount: number;
  onSelect: () => void;
}

function RootNode({
  box,
  concept,
  isSelected,
  totalCount,
  onSelect,
}: RootNodeProps) {
  const { t } = useTranslation();

  return (
    <div
      className="tw:absolute tw:rounded-xl tw:border-4 tw:border-utility-blue-100"
      style={{
        height: box.height + 8,
        left: box.left - 4,
        top: box.top - 4,
        width: box.width + 8,
      }}>
      {/* ADR:2026-10-30-data-mode-asset-rows-are-styled-at-the-call-site-until-core-ships-a-list-row-button */}
      <Button
        noTextPadding
        aria-pressed={isSelected}
        className={classNames(
          'tw:flex tw:h-full tw:w-full tw:items-center tw:rounded-lg tw:border tw:border-brand tw:bg-surface tw:px-3 tw:text-left',
          'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:min-w-0 tw:*:data-text:items-center tw:*:data-text:gap-2'
        )}
        color="tertiary"
        data-testid={`ontology-data-root-${concept.id}`}
        onClick={onSelect}>
        <span
          aria-hidden="true"
          className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-utility-blue-500"
        />
        <Typography
          ellipsis
          className="tw:min-w-0 tw:text-primary"
          size="text-sm"
          weight="semibold">
          {concept.originalLabel ?? concept.label}
        </Typography>
        {/* The chip shows the total; the root keeps it for assistive tech only. */}
        <span className="tw:sr-only" data-testid="ontology-data-cluster-count">
          {`· ${totalCount}`}
        </span>
        <Typography
          className="tw:ml-auto tw:shrink-0 tw:uppercase"
          color="brand"
          size="text-xs"
          weight="semibold">
          {t('label.root')}
        </Typography>
      </Button>
    </div>
  );
}

/**
 * The single-concept Data graph: the concept as a root node, its assets in
 * panels per source, curved binding edges, observed lineage between assets and,
 * on demand, an asset's bound columns.
 */
const OntologyNativeDataCanvas = ({
  assets,
  concept,
  isConceptSelected,
  lineage,
  menu,
  selectedAssetNodeId,
  selectedColumnKey,
  onLinkData,
  onLoadMore,
  onPaneClick,
  onSelectAsset,
  onSelectColumn,
  onSelectConcept,
}: OntologyNativeDataCanvasProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string>();
  const [expandedColumnIds, setExpandedColumnIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [fullColumnIds, setFullColumnIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [view, setView] = useState(INITIAL_VIEW);
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const panRef = useRef<{
    capturing: boolean;
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const didPanRef = useRef(false);

  const totalCount = Math.max(concept.assetCount ?? 0, assets.length);
  const shownAssets = isExpanded
    ? assets
    : assets.slice(0, NATIVE_COLLAPSED_ASSET_COUNT);
  const hiddenCount = totalCount - shownAssets.length;
  const canShowLess =
    isExpanded && assets.length > NATIVE_COLLAPSED_ASSET_COUNT;
  const groups = useMemo(() => groupBySource(shownAssets), [shownAssets]);
  const layout = useMemo(
    () =>
      layoutSourceGroups(
        groups.map(({ assets: groupAssets, key }) => ({
          itemIds: groupAssets.map(({ id }) => id),
          key,
        }))
      ),
    [groups]
  );
  const columns = useMemo(() => {
    const columnsByKey = new Map<
      string,
      { asset: OntologyNode; column: BoundColumn }
    >();
    const lanes = shownAssets.flatMap((asset) => {
      const row = layout.cards.get(asset.id);
      if (!row || !expandedColumnIds.has(asset.id)) {
        return [];
      }
      const columnKeys = (asset.boundColumns ?? []).map((column) => {
        const key = columnNodeKey(asset.id, column.path);
        columnsByKey.set(key, { asset, column });

        return key;
      });

      return [
        {
          assetId: asset.id,
          columnKeys,
          isShowingAll: fullColumnIds.has(asset.id),
          row,
        },
      ];
    });

    return { ...layoutColumnNodes(lanes), columnsByKey };
  }, [expandedColumnIds, fullColumnIds, layout.cards, shownAssets]);
  const hasFooter = [
    hiddenCount > 0,
    canShowLess,
    concept.isLoadingAssets,
  ].some(Boolean);
  const footerTop = layout.bottom + FOOTER_GAP;
  const linkTop = footerTop + (hasFooter ? FOOTER_ROW_HEIGHT : 0);
  const contentWidth = Math.max(layout.width, columns.right + 40);
  const contentHeight = Math.max(
    linkTop + (onLinkData ? FOOTER_ROW_HEIGHT : 0),
    columns.bottom + 40
  );
  const activeId = hoveredId ?? selectedAssetNodeId;
  const legendEntries = buildLegend(
    t,
    lineage.length > 0,
    assets.some((asset) => (asset.boundColumns?.length ?? 0) > 0)
  );

  const toggleColumns = useCallback(
    (asset: OntologyNode) =>
      setExpandedColumnIds((current) => toggled(current, asset.id)),
    []
  );
  const toggleAllColumns = (assetId: string) =>
    setFullColumnIds((current) => toggled(current, assetId));

  // Binds the non-passive wheel listener exactly when the container mounts.
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
        const zoom = clampZoom(
          current.zoom *
            (event.deltaY < 0 ? 1 + WHEEL_ZOOM_STEP : 1 - WHEEL_ZOOM_STEP)
        );
        const ratio = zoom / current.zoom;

        return {
          x: pointerX - (pointerX - current.x) * ratio,
          y: pointerY - (pointerY - current.y) * ratio,
          zoom,
        };
      });
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    wheelCleanupRef.current = () =>
      node.removeEventListener('wheel', handleWheel);
  }, []);

  const zoomAtCenter = (factor: number) => {
    const element = containerRef.current;
    const centerX = (element?.clientWidth ?? 0) / 2;
    const centerY = (element?.clientHeight ?? 0) / 2;
    setView((current) => {
      const zoom = clampZoom(current.zoom * factor);
      const ratio = zoom / current.zoom;

      return {
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
        zoom,
      };
    });
  };

  const fitToScreen = () => {
    const element = containerRef.current;
    if (!element || element.clientWidth === 0) {
      return;
    }
    const zoom = clampZoom(
      Math.min(
        1,
        element.clientWidth / contentWidth,
        (element.clientHeight - INITIAL_VIEW.y) / contentHeight
      )
    );
    setView({ x: 0, y: INITIAL_VIEW.y, zoom });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      (event.target as HTMLElement).closest(
        'button, a, [role="menu"], [data-testid="ontology-data-graph-controls"]'
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
    if (
      !drag.capturing &&
      Math.max(Math.abs(deltaX), Math.abs(deltaY)) > PAN_THRESHOLD
    ) {
      drag.capturing = true;
      didPanRef.current = true;
      setIsPanning(true);
      containerRef.current?.setPointerCapture?.(drag.pointerId);
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
      containerRef.current?.releasePointerCapture?.(event.pointerId);
    }
  };

  // A drag that panned must not also fire the click under it.
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (didPanRef.current) {
      event.stopPropagation();
      didPanRef.current = false;
    }
  };

  const renderColumnSlot = (slot: ColumnSlot) => {
    const style = {
      height: slot.height,
      left: slot.left,
      top: slot.top,
      width: slot.width,
    };
    if (slot.kind !== 'column') {
      return (
        <Button
          className="tw:absolute tw:border-dashed"
          color="secondary"
          data-testid={`ontology-data-column-${slot.kind}-${slot.assetId}`}
          key={`${slot.kind}-${slot.assetId}`}
          size="xs"
          style={style}
          onPress={() => toggleAllColumns(slot.assetId)}>
          {slot.kind === 'more'
            ? t('label.show-count-more', { count: slot.hiddenCount })
            : t('label.show-less')}
        </Button>
      );
    }
    const entry = columns.columnsByKey.get(slot.columnKey);
    if (!entry) {
      return null;
    }
    const { asset, column } = entry;
    const isSelected = slot.columnKey === selectedColumnKey;

    return (
      // ADR:2026-10-30-data-mode-asset-rows-are-styled-at-the-call-site-until-core-ships-a-list-row-button
      <Button
        noTextPadding
        aria-label={t('label.ontology-column-node-aria', {
          asset: asset.label,
          column: column.path.join('.'),
          property: column.propertyLabel,
          type: column.type ?? '',
        })}
        aria-pressed={isSelected}
        className={classNames(
          'tw:absolute tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:bg-surface tw:px-2.5 tw:text-left',
          'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:min-w-0 tw:*:data-text:items-center tw:*:data-text:gap-2',
          isSelected ? 'tw:border-brand' : 'tw:border-secondary'
        )}
        color="tertiary"
        data-testid="ontology-data-column"
        key={slot.columnKey}
        style={style}
        onPress={() => onSelectColumn(asset, column)}>
        <Columns03
          aria-hidden="true"
          className="tw:size-3.5 tw:shrink-0 tw:text-fg-quaternary"
        />
        <Typography
          ellipsis
          className="tw:min-w-0 tw:flex-1 tw:text-primary"
          size="text-xs"
          title={column.path.join('.')}
          weight="medium">
          {column.path.join('.')}
        </Typography>
        {column.type ? (
          <Typography
            className="tw:shrink-0"
            color={column.isResolved ? 'secondary' : 'danger'}
            size="text-xs">
            {column.type}
          </Typography>
        ) : null}
      </Button>
    );
  };

  const renderEdges = () => (
    <svg
      aria-hidden="true"
      className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-visible"
      height={contentHeight}
      width={contentWidth}>
      {shownAssets.map((asset) => {
        const card = layout.cards.get(asset.id);
        const isActive = asset.id === activeId;

        return card ? (
          <path
            d={sideCurve(layout.root, card)}
            data-active={isActive}
            data-testid="ontology-data-asset-edge"
            fill="none"
            key={asset.id}
            stroke={isActive ? ACTIVE_EDGE_COLOR : ASSET_EDGE_COLOR}
            strokeWidth={isActive ? 2 : 1.5}
          />
        ) : null;
      })}
      {lineage.map(({ from, to }) => {
        const fromCard = layout.cards.get(from);
        const toCard = layout.cards.get(to);
        if (!fromCard || !toCard) {
          return null;
        }

        return (
          <g key={`${from}|${to}`}>
            <path
              d={rightSideLoop(fromCard, toCard)}
              data-edge-kind="observedLineage"
              data-testid="ontology-data-semantic-edge"
              fill="none"
              stroke={LINEAGE_EDGE_COLOR}
              strokeWidth="1.5"
            />
            <circle
              cx={toCard.left + toCard.width}
              cy={toCard.top + toCard.height / 2}
              data-testid="ontology-data-edge-arrow"
              fill={LINEAGE_EDGE_COLOR}
              r="3"
            />
          </g>
        );
      })}
      {columns.edges.map(({ columnKey, path }) => (
        <path
          d={path}
          data-column={columns.columnsByKey
            .get(columnKey)
            ?.column.path.join('.')}
          data-testid="ontology-data-column-edge"
          fill="none"
          key={columnKey}
          stroke={COLUMN_EDGE_COLOR}
          strokeDasharray="2 3"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );

  const renderGroups = () => (
    <div data-testid={`ontology-data-cluster-rows-${concept.id}`}>
      {groups.map((group, index) => {
        const box = layout.groups[index];

        return (
          <section
            aria-label={group.serviceType ?? t('label.other')}
            className="tw:absolute tw:rounded-xl tw:border tw:border-secondary tw:bg-surface"
            data-testid={`ontology-data-source-${group.key || 'other'}`}
            key={group.key}
            style={box}>
            <Box
              align="center"
              className="tw:px-3"
              gap={2}
              style={{ height: SOURCE_GROUP_HEADER_HEIGHT }}>
              <ServiceBadge serviceType={group.serviceType} />
              <Typography
                ellipsis
                className="tw:uppercase"
                color="secondary"
                size="text-xs"
                weight="semibold">
                {group.serviceType ?? t('label.other')}
              </Typography>
              <Typography color="secondary" size="text-xs">
                {group.assets.length}
              </Typography>
            </Box>
          </section>
        );
      })}
      {shownAssets.map((asset) => {
        const box = layout.cards.get(asset.id);

        return box ? (
          <AssetCard
            asset={asset}
            box={box}
            isColumnsOpen={expandedColumnIds.has(asset.id)}
            isSelected={asset.id === selectedAssetNodeId}
            key={asset.id}
            menu={menu}
            onHover={setHoveredId}
            onSelect={onSelectAsset}
            onToggleColumns={toggleColumns}
          />
        ) : null;
      })}
    </div>
  );

  const renderFooter = () => (
    <>
      {hasFooter ? (
        <Box
          className="tw:absolute"
          gap={4}
          justify="center"
          style={{
            left: layout.groupLeft,
            top: footerTop,
            width: layout.width - layout.groupLeft - 40,
          }}>
          {hiddenCount > 0 || concept.isLoadingAssets ? (
            <Button
              color="link-color"
              data-testid={`ontology-load-more-assets-${concept.id}`}
              iconLeading={ChevronDown}
              isDisabled={concept.isLoadingAssets}
              size="sm"
              onPress={() => {
                if (assets.length < totalCount) {
                  onLoadMore();
                }
                setIsExpanded(true);
              }}>
              {concept.isLoadingAssets
                ? t('label.loading')
                : t('label.load-more-count', { count: hiddenCount })}
            </Button>
          ) : null}
          {canShowLess ? (
            <Button
              color="link-color"
              data-testid={`ontology-show-less-assets-${concept.id}`}
              iconLeading={ChevronUp}
              size="sm"
              onPress={() => setIsExpanded(false)}>
              {t('label.show-less')}
            </Button>
          ) : null}
        </Box>
      ) : null}
      {onLinkData ? (
        <Button
          className="tw:absolute tw:border-dashed"
          color="secondary"
          data-testid="ontology-data-link-more"
          iconLeading={Plus}
          size="sm"
          style={{
            left: layout.groupLeft,
            top: linkTop,
            width: layout.width - layout.groupLeft - 40,
          }}
          onPress={onLinkData}>
          {t('label.link-data')}
        </Button>
      ) : null}
    </>
  );

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
        data-testid={`ontology-data-cluster-${concept.id}`}
        role="button"
        style={{
          height: contentHeight,
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
          width: contentWidth,
        }}
        tabIndex={0}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onPaneClick();
          }
        }}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && event.key === 'Escape') {
            onPaneClick();
          }
        }}>
        {renderEdges()}
        <RootNode
          box={layout.root}
          concept={concept}
          isSelected={isConceptSelected}
          totalCount={totalCount}
          onSelect={onSelectConcept}
        />
        {renderGroups()}
        {columns.slots.map(renderColumnSlot)}
        {renderFooter()}
      </div>
      <Box
        align="end"
        className="tw:absolute tw:bottom-3.5 tw:left-3.5 tw:z-6"
        gap={2}>
        <div
          className="tw:overflow-hidden tw:rounded-md tw:border tw:border-secondary tw:bg-surface tw:shadow-xs"
          data-testid="ontology-data-graph-controls">
          <OntologyControlButtons
            isLoading={false}
            onFitToScreen={fitToScreen}
            onRefresh={() => setView(INITIAL_VIEW)}
            onZoomIn={() => zoomAtCenter(ZOOM_BUTTON_FACTOR)}
            onZoomOut={() => zoomAtCenter(1 / ZOOM_BUTTON_FACTOR)}
          />
        </div>
        <DataEdgeLegend entries={legendEntries} />
      </Box>
    </div>
  );
};

export default OntologyNativeDataCanvas;
