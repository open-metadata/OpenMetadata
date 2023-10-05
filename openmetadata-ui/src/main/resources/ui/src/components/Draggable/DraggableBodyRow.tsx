/*
 *  Copyright 2023 Collate.
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

import { isUndefined } from 'lodash';
import React, { useEffect, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { DRAGGABLE_BODY_ROW } from '../../constants/Teams.constants';
import {
  DragCollectProps,
  DraggableBodyRowProps,
  DraggableUnion,
} from './DraggableBodyRowProps.interface';

const DraggableBodyRow = <T extends DraggableUnion>({
  index,
  handleMoveRow,
  handleTableHover,
  className,
  record,
  style,
  ...restProps
}: DraggableBodyRowProps<T>) => {
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
          dragIndex < (index ?? 0) ? 'drop-over-downward' : 'drop-over-upward',
      };
    },
    hover: () => {
      handleTableHover?.(isUndefined(index));
    },
    // this will going to return the drag and drop object of a table
    drop: ({ record: dragRecord }: { record: T }) => {
      handleMoveRow(dragRecord, record);
    },
  });
  // here we are passing the drag record
  const [{ isDragging }, drag] = useDrag({
    type: DRAGGABLE_BODY_ROW,
    item: { record },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  drop(drag(ref));

  useEffect(() => {
    if (!isDragging) {
      handleTableHover?.(false);
    }
  }, [isDragging]);

  return (
    <tr
      className={`${className} ${isOver ? dropClassName : ''}`}
      ref={ref}
      style={{
        cursor: 'move',
        ...style,
      }}
      {...restProps}
    />
  );
};

export default DraggableBodyRow;
