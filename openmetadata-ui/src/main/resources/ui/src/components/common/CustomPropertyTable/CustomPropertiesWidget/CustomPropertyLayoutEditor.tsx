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
import { Collapse, Expand } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { TYPE_ICON_TILE_CLASS } from '../CustomPropertyCard/CustomPropertyCard.constants';
import { getPropertyTypeMeta } from '../CustomPropertyCard/CustomPropertyCard.utils';
import { LaidOutCustomProperty } from './CustomPropertiesWidget.types';

const DRAG_TYPE = 'CUSTOM_PROPERTY_LAYOUT_ITEM';

interface DragItem {
  index: number;
}

interface LayoutTileProps {
  item: LaidOutCustomProperty;
  index: number;
  onMove: (fromIndex: number, toIndex: number) => void;
  onToggleWidth: (index: number) => void;
}

const LayoutTile = ({
  item,
  index,
  onMove,
  onToggleWidth,
}: LayoutTileProps) => {
  const { t } = useTranslation();
  const { property, width } = item;
  const meta = getPropertyTypeMeta(property.propertyType.name);
  const TypeIcon = meta.icon;
  const isFull = width === 'full';

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE,
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [, drop] = useDrop({
    accept: DRAG_TYPE,
    hover: (dragged: DragItem) => {
      if (dragged.index !== index) {
        onMove(dragged.index, index);
        dragged.index = index;
      }
    },
  });

  return (
    <div
      className={classNames(
        'tw:flex tw:min-w-0 tw:cursor-grab tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-2.5',
        { 'tw:col-span-2': isFull, 'tw:opacity-50': isDragging }
      )}
      data-testid={`layout-item-${property.name}`}
      ref={(node) => {
        drag(drop(node));
      }}>
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
        {getEntityName(property)}
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
    </div>
  );
};

interface CustomPropertyLayoutEditorProps {
  items: LaidOutCustomProperty[];
  onChange: (items: LaidOutCustomProperty[]) => void;
}

/**
 * Two-column drag-and-drop arrangement of custom properties. Drag a tile to
 * move it; the width button makes it span one or both columns.
 */
export const CustomPropertyLayoutEditor = ({
  items,
  onChange,
}: CustomPropertyLayoutEditorProps) => {
  const handleMove = (fromIndex: number, toIndex: number) => {
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

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
      className="tw:grid tw:grid-flow-row-dense tw:grid-cols-2 tw:gap-2"
      data-testid="custom-property-layout-editor">
      {items.map((item, index) => (
        <LayoutTile
          index={index}
          item={item}
          key={item.property.name}
          onMove={handleMove}
          onToggleWidth={handleToggleWidth}
        />
      ))}
    </div>
  );
};
