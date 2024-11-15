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
import { Checkbox } from 'antd';
import React, { useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ReactComponent as ColumnDragIcon } from '../../../assets/svg/menu-duo.svg';

interface DraggableMenuItemProps {
  option: { value: string; label: string };
  index: number;
  options: { value: string; label: string }[];
  onMoveItem: (updatedList: { value: string; label: string }[]) => void;
  selectedOptions: string[];
  onSelect: (key: string, checked: boolean, type: 'columns' | 'status') => void;
}
const DraggableMenuItem: React.FC<DraggableMenuItemProps> = ({
  option,
  index,
  options,
  onMoveItem,
  selectedOptions,
  onSelect,
}) => {
  const moveDropdownMenuItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      const updatedList = [...options];
      const [movedItem] = updatedList.splice(fromIndex, 1);
      updatedList.splice(toIndex, 0, movedItem);
      onMoveItem(updatedList);
    },
    [options, onMoveItem]
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

  return (
    <div
      className={`draggable-menu-item ${isDragging ? 'dragging' : ''}`}
      ref={(node) => {
        drag(drop(node));
      }}>
      <ColumnDragIcon
        className="glossary-col-dropdown-drag-icon m-l-xs m-t-xs"
        height={16}
        width={16}
      />
      <Checkbox
        checked={selectedOptions.includes(option.value)}
        className="custom-glossary-col-sel-checkbox"
        key={option.value}
        value={option.value}
        onChange={(e) => onSelect(option.value, e.target.checked, 'columns')}>
        <p className="glossary-dropdown-label">{option.label}</p>
      </Checkbox>
    </div>
  );
};

export default DraggableMenuItem;
