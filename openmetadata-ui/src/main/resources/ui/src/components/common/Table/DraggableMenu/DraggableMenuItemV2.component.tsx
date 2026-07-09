/*
 *  Copyright 2024 Collate.
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
import { Box, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { Eye, EyeOff } from '@untitledui/icons';
import classNames from 'classnames';
import { FC, useCallback, useMemo } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ReactComponent as ColumnDragIcon } from '../../../../assets/svg/menu-duo.svg';
import { DraggableMenuItemProps } from './DraggableMenuItem.interface';

/**
 * react-aria (`Dropdown.Item`) flavour of the draggable column menu item, used
 * inside `TableV2`'s react-aria `Dropdown.Menu`. react-dnd connectors are wired
 * to real DOM nodes we render inside the menu item: `drag` on the grip handle
 * (so the item's press handling doesn't swallow the native drag) and `drop` +
 * `dragPreview` on the whole row. For the AntD `Table` use the sibling
 * `DraggableMenuItem` component instead.
 */
const DraggableMenuItemV2: FC<DraggableMenuItemProps> = ({
  currentItem,
  index,
  itemList,
  selectedOptions,
  onSelect,
  onMoveItem,
}) => {
  const { value, label } = currentItem;
  const moveDropdownMenuItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      const updatedList = [...itemList];
      const [movedItem] = updatedList.splice(fromIndex, 1);
      updatedList.splice(toIndex, 0, movedItem);
      onMoveItem(updatedList);
    },
    [itemList, onMoveItem]
  );

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: 'CHECKBOX',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'CHECKBOX',
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveDropdownMenuItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  const isItemSelected = useMemo(
    () => selectedOptions.includes(value),
    [selectedOptions, value]
  );

  return (
    <Dropdown.Item
      className={classNames('draggable-menu-item-v2', {
        'tw:opacity-80': isDragging,
      })}
      id={value}
      textValue={label}
      onPress={() => onSelect(value, !isItemSelected)}>
      <Box
        align="center"
        className="tw:w-full"
        gap={2}
        ref={(node) => {
          drop(dragPreview(node));
        }}>
        <span
          className="tw:inline-flex tw:cursor-grab tw:items-center tw:active:cursor-grabbing"
          data-testid="draggable-menu-item-drag-handle"
          ref={drag}>
          <ColumnDragIcon
            className="text-grey-muted"
            data-testid="draggable-menu-item-drag-icon"
            height={16}
            width={16}
          />
        </span>

        <Typography>{label}</Typography>

        {isItemSelected ? (
          <Eye aria-label="eye" className="tw:ml-auto tw:size-4" />
        ) : (
          <EyeOff aria-label="eye-invisible" className="tw:ml-auto tw:size-4" />
        )}
      </Box>
    </Dropdown.Item>
  );
};

export default DraggableMenuItemV2;
