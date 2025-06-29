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
import { EyeInvisibleFilled, EyeOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { useCallback, useMemo } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ReactComponent as ColumnDragIcon } from '../../../../assets/svg/menu-duo.svg';
import './draggable-menu-item.less';
import { DraggableMenuItemProps } from './DraggableMenuItem.interface';

const DraggableMenuItem: React.FC<DraggableMenuItemProps> = ({
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
  const [{ isDragging }, drag] = useDrag({
    type: 'CHECKBOX',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'CHECKBOX',
    hover: (draggedItem: any) => {
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
    <div
      className={`draggable-menu-item ${isDragging ? 'dragging' : ''}`}
      ref={(node) => {
        drag(drop(node));
      }}>
      <ColumnDragIcon
        className="text-grey-muted"
        data-testid="draggable-menu-item-drag-icon"
        height={16}
        width={16}
      />

      <Button
        className="draggable-menu-item-button"
        type="text"
        onClick={() => onSelect(value, !isItemSelected)}>
        <Typography.Text className="draggable-menu-item-button-label">
          {label}
        </Typography.Text>

        {isItemSelected ? <EyeOutlined /> : <EyeInvisibleFilled />}
      </Button>
    </div>
  );
};

export default DraggableMenuItem;
