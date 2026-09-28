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
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Collapse,
  DotsGrid,
  Expand,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { TYPE_ICON_TILE_CLASS } from '../CustomPropertyCard/CustomPropertyCard.constants';
import { getPropertyTypeMeta } from '../CustomPropertyCard/CustomPropertyCard.utils';
import {
  LaidOutCustomProperty,
  LayoutDropTarget,
} from './CustomPropertiesWidget.types';
import {
  getLayoutDropIndex,
  moveLayoutItem,
} from './CustomPropertiesWidget.utils';

const DRAG_TYPE = 'CUSTOM_PROPERTY_LAYOUT_ITEM';

interface DragItem {
  index: number;
}

// Insertion line in the grid gap: beside half tiles (they share a row),
// above or below full tiles (they stack).
const DROP_INDICATOR_CLASS = {
  half: {
    before: 'tw:inset-y-0 tw:-left-1.5 tw:w-0.5',
    after: 'tw:inset-y-0 tw:-right-1.5 tw:w-0.5',
  },
  full: {
    before: 'tw:inset-x-0 tw:-top-1.5 tw:h-0.5',
    after: 'tw:inset-x-0 tw:-bottom-1.5 tw:h-0.5',
  },
} as const;

interface LayoutTileProps {
  item: LaidOutCustomProperty;
  index: number;
  dropSide?: LayoutDropTarget['side'];
  onHover: (fromIndex: number, target: LayoutDropTarget) => void;
  onDragEnd: () => void;
  onToggleWidth: (index: number) => void;
}

const LayoutTile = ({
  item,
  index,
  dropSide,
  onHover,
  onDragEnd,
  onToggleWidth,
}: LayoutTileProps) => {
  const { t } = useTranslation();
  const tileRef = useRef<HTMLDivElement>(null);
  const { property, width } = item;
  const meta = getPropertyTypeMeta(property.propertyType.name);
  const TypeIcon = meta.icon;
  const isFull = width === 'full';
  const propertyLabel = getEntityName(property);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    end: onDragEnd,
  });

  const [, drop] = useDrop<DragItem>({
    accept: DRAG_TYPE,
    hover: (dragged, monitor) => {
      const rect = tileRef.current?.getBoundingClientRect();
      const pointer = monitor.getClientOffset();
      if (!rect || !pointer) {
        return;
      }
      const isBefore = isFull
        ? pointer.y < rect.top + rect.height / 2
        : pointer.x < rect.left + rect.width / 2;
      onHover(dragged.index, { index, side: isBefore ? 'before' : 'after' });
    },
  });

  preview(drop(tileRef));

  return (
    <div
      className={classNames(
        'tw:relative tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:bg-primary tw:py-2.5 tw:pr-3 tw:pl-1.5',
        isDragging
          ? 'tw:border-dashed tw:border-brand tw:opacity-50'
          : 'tw:border-secondary',
        { 'tw:col-span-2': isFull }
      )}
      data-testid={`layout-item-${property.name}`}
      ref={tileRef}>
      {/* Pointer-only handle; the tile's width button stays keyboard reachable. */}
      <span
        aria-hidden
        className="tw:flex tw:shrink-0 tw:cursor-grab tw:rounded tw:p-1 tw:text-fg-quaternary tw:hover:bg-secondary tw:hover:text-fg-secondary tw:active:cursor-grabbing"
        data-testid={`layout-item-${property.name}-handle`}
        ref={(node) => {
          drag(node);
        }}>
        <DotsGrid className="tw:size-4" />
      </span>
      <span
        aria-hidden
        className={`tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg ${
          TYPE_ICON_TILE_CLASS[meta.color]
        }`}>
        <TypeIcon className="tw:size-4" />
      </span>
      <Typography
        className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-medium tw:text-primary"
        size="text-xs">
        {propertyLabel}
      </Typography>
      <Badge color={meta.color} size="sm" type="color">
        {t(meta.labelKey)}
      </Badge>
      <ButtonUtility
        color="tertiary"
        data-testid={`layout-item-${property.name}-width`}
        icon={isFull ? Collapse : Expand}
        size="xs"
        tooltip={t(isFull ? 'label.half-width' : 'label.full-width')}
        onClick={() => onToggleWidth(index)}
      />
      {dropSide && (
        <span
          aria-hidden
          className={classNames(
            'tw:pointer-events-none tw:absolute tw:rounded-full tw:bg-brand-solid',
            DROP_INDICATOR_CLASS[width][dropSide]
          )}
          data-testid="layout-drop-indicator"
        />
      )}
    </div>
  );
};

interface CustomPropertyLayoutEditorProps {
  items: LaidOutCustomProperty[];
  onChange: (items: LaidOutCustomProperty[]) => void;
}

/**
 * Two-column arrangement of custom properties. Drag a tile by its handle; a
 * line shows where it will land and the order changes only on drop, so the
 * grid does not reflow under the pointer. The width button makes a tile span
 * one or both columns.
 */
export const CustomPropertyLayoutEditor = ({
  items,
  onChange,
}: CustomPropertyLayoutEditorProps) => {
  const [dropTarget, setDropTarget] = useState<LayoutDropTarget>();

  const handleHover = (fromIndex: number, target: LayoutDropTarget) => {
    const next =
      getLayoutDropIndex(fromIndex, target) === undefined ? undefined : target;
    setDropTarget((current) => (isEqual(current, next) ? current : next));
  };

  const clearDropTarget = () => setDropTarget(undefined);

  // The grid is the drop zone, so a drop in the gap between tiles still lands.
  const [, drop] = useDrop<DragItem>({
    accept: DRAG_TYPE,
    drop: (dragged) => {
      const toIndex = dropTarget
        ? getLayoutDropIndex(dragged.index, dropTarget)
        : undefined;
      if (toIndex !== undefined) {
        onChange(moveLayoutItem(items, dragged.index, toIndex));
      }
      clearDropTarget();
    },
  });

  const handleToggleWidth = (index: number) =>
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, width: item.width === 'full' ? 'half' : 'full' }
          : item
      )
    );

  return (
    <div
      className="tw:grid tw:grid-flow-row-dense tw:grid-cols-2 tw:gap-3"
      data-testid="custom-property-layout-editor"
      ref={(node) => {
        drop(node);
      }}>
      {items.map((item, index) => (
        <LayoutTile
          dropSide={dropTarget?.index === index ? dropTarget.side : undefined}
          index={index}
          item={item}
          key={item.property.name}
          onDragEnd={clearDropTarget}
          onHover={handleHover}
          onToggleWidth={handleToggleWidth}
        />
      ))}
    </div>
  );
};
