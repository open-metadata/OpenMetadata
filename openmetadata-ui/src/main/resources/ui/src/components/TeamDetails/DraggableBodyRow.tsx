/*
 *  Copyright 2022 Collate.
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

import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { DRAGGABLE_BODY_ROW } from '../../constants/Teams.constants';
import { Team } from '../../generated/entity/teams/team';
import { DragCollectProps, DraggableBodyRowProps } from './team.interface';

const DraggableBodyRow = ({
  index,
  handleMoveRow,
  className,
  record,
  style,
  ...restProps
}: DraggableBodyRowProps) => {
  const ref = useRef<HTMLTableRowElement>(null);
  const [{ isOver, dropClassName }, drop] = useDrop({
    accept: DRAGGABLE_BODY_ROW,
    collect: (monitor: DragCollectProps) => {
      const { index: dragIndex } = monitor?.getItem() || {};
      if (dragIndex === index) {
        return {};
      }

      return {
        isOver: monitor.isOver(),
        dropClassName:
          dragIndex < index ? ' drop-over-downward' : ' drop-over-upward',
      };
    },
    // this will going to return the drag and drop object of a table
    drop: ({ record: dragRecord }: { record: Team }) => {
      handleMoveRow(dragRecord, record);
    },
  });
  // here we are passing the drag record
  const [, drag] = useDrag({
    type: DRAGGABLE_BODY_ROW,
    item: { record },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  drop(drag(ref));

  return (
    <tr
      className={`${className}${isOver ? dropClassName : ''}`}
      ref={ref}
      style={{ cursor: 'move', ...style }}
      {...restProps}
    />
  );
};

export default DraggableBodyRow;
