import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { DRAGGABLE_BODY_ROW } from '../../constants/constants';
import { Team } from '../../generated/entity/teams/team';
import { DragCollectProps, DraggableBodyRowProps } from './team.interface';

const DraggableBodyRow = ({
  index,
  moveRow,
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
    drop: ({ record: dragRecord }: { record: Team }) => {
      moveRow(dragRecord, record);
    },
  });
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
