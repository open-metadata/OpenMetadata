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
import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ReactComponent as ColumnDragIcon } from '../../../assets/svg/menu-duo.svg';

interface DraggableMenuItemProps {
  option: { value: string; label: string };
  index: number;
  moveDropdownMenuItem: (fromIndex: number, toIndex: number) => void;
  tempCheckedList: string[];
  handleCheckboxChange: (
    key: string,
    checked: boolean,
    type: 'columns' | 'status'
  ) => void;
}
const DraggableMenuItem: React.FC<DraggableMenuItemProps> = ({
  option,
  index,
  moveDropdownMenuItem,
  tempCheckedList,
  handleCheckboxChange,
}) => {
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
      ref={(node) => {
        drag(drop(node));
      }}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        opacity: isDragging ? 0.8 : 1,
      }}>
      <ColumnDragIcon height={16} width={16} />
      <Checkbox
        checked={tempCheckedList.includes(option.value)}
        className="custom-glossary-col-sel-checkbox"
        key={option.value}
        value={option.value}
        onChange={(e) =>
          handleCheckboxChange(option.value, e.target.checked, 'columns')
        }>
        <p style={{ fontSize: '14px', lineHeight: '21px', color: '#757575' }}>
          {option.label}
        </p>
      </Checkbox>
    </div>
  );
};

export default DraggableMenuItem;
