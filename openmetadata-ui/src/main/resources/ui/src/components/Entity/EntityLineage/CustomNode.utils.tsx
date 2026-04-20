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
import { Dataflow01, Plus } from '@untitledui/icons';
import { Button, Skeleton, Typography } from 'antd';
import classNames from 'classnames';
import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { Handle, HandleProps, HandleType, Position } from 'reactflow';
import { ReactComponent as MinusIcon } from '../../../assets/svg/control-minus.svg';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { DataType } from '../../../generated/entity/data/table';
import { ColumnTestSummaryDefinition } from '../../../generated/tests/testCase';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getEntityName } from '../../../utils/EntityUtils';
import { getColumnDataTypeIcon } from '../../../utils/TableUtils';
import { EntityChildrenItem } from './NodeChildren/NodeChildren.interface';
import TestSuiteSummaryWidget from './TestSuiteSummaryWidget/TestSuiteSummaryWidget.component';

const DEPTH_INDENT_PX = 16;

export const getHandleByType = (
  isConnectable: HandleProps['isConnectable'],
  position: Position,
  type: HandleType,
  className?: string,
  id?: string
) => {
  return (
    <Handle
      className={className}
      id={id}
      isConnectable={isConnectable}
      position={position}
      type={type}
    />
  );
};

export const getColumnHandle = (
  nodeType: string,
  isConnectable: HandleProps['isConnectable'],
  className?: string,
  id?: string
) => {
  if (nodeType === EntityLineageNodeType.NOT_CONNECTED) {
    return null;
  } else {
    return (
      <Fragment>
        {getHandleByType(isConnectable, Position.Left, 'target', className, id)}
        {getHandleByType(
          isConnectable,
          Position.Right,
          'source',
          className,
          id
        )}
      </Fragment>
    );
  }
};

const ExpandHandle = ({
  direction,
  onClickHandler,
}: {
  direction: LineageDirection;
  onClickHandler: (depth: number) => void;
}) => {
  const [showExpandAll, setShowExpandAll] = useState(false);

  const handleLineageNodeHandleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleLineageNodeHandleMouseOver = useCallback(() => {
    setShowExpandAll(true);
  }, []);

  const handleLineageNodeHandleMouseOut = useCallback(() => {
    setShowExpandAll(false);
  }, []);

  const handleLineageExpandIconClick = useCallback(() => {
    onClickHandler(1);
  }, [onClickHandler]);

  const handleLineageExpandAllIconClick = useCallback(() => {
    onClickHandler(50);
  }, [onClickHandler]);

  return (
    <div
      className={classNames(
        'absolute lineage-node-handle-expand-all flex-center',
        direction === LineageDirection.Downstream
          ? 'react-flow__handle-right'
          : 'react-flow__handle-left'
      )}
      onClick={handleLineageNodeHandleClick}
      onMouseOut={handleLineageNodeHandleMouseOut}
      onMouseOver={handleLineageNodeHandleMouseOver}>
      <Plus
        aria-hidden="false"
        aria-label="expand"
        className="lineage-expand-icon"
        data-testid="plus-icon"
        onClick={handleLineageExpandIconClick}
      />
      {showExpandAll && (
        <>
          <div className="lineage-expand-icons-separator" />
          <Dataflow01
            className="lineage-expand-icon"
            data-testid="lineage-expand-all-btn"
            onClick={handleLineageExpandAllIconClick}
          />
        </>
      )}
    </div>
  );
};

export const getExpandHandle = (
  direction: LineageDirection,
  onClickHandler: (depth: number) => void
) => {
  return <ExpandHandle direction={direction} onClickHandler={onClickHandler} />;
};

export const getCollapseHandle = (
  direction: LineageDirection,
  onClickHandler: () => void
) => {
  return (
    <Button
      className={classNames(
        'absolute lineage-node-minus lineage-node-handle flex-center',
        direction === LineageDirection.Downstream
          ? 'react-flow__handle-right'
          : 'react-flow__handle-left'
      )}
      data-testid={
        direction === LineageDirection.Downstream
          ? 'downstream-collapse-handle'
          : 'upstream-collapse-handle'
      }
      icon={
        <MinusIcon className="lineage-expand-icon " data-testid="minus-icon" />
      }
      shape="circle"
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onClickHandler();
      }}
    />
  );
};

const getColumnNameContent = (
  column: EntityChildrenItem,
  isLoading: boolean
) => {
  if (isLoading) {
    return <Skeleton.Button active data-tesid="loader" size="small" />;
  }

  return (
    <>
      {'dataType' in column && column.dataType && (
        <div className="custom-node-name-icon">
          {getColumnDataTypeIcon({
            dataType: column.dataType as DataType,
            width: '14px',
          })}
        </div>
      )}
      <Typography.Text
        className="custom-node-column-label"
        ellipsis={{
          tooltip: true,
        }}>
        {getEntityName(column)}
      </Typography.Text>
    </>
  );
};

interface ColumnContentProps {
  column: EntityChildrenItem;
  isConnectable: boolean;
  showDataObservabilitySummary: boolean;
  isLoading: boolean;
  summary?: ColumnTestSummaryDefinition;
  depth?: number;
  className?: string;
}

const ColumnContentInner = ({
  column,
  isConnectable,
  showDataObservabilitySummary,
  isLoading,
  summary,
  depth = 0,
  className = '',
}: ColumnContentProps) => {
  const { onColumnMouseEnter } = useLineageProvider();
  const {
    selectedColumn,
    setSelectedColumn,
    setTracedColumns,
    isEditMode,
    tracedColumns,
  } = useLineageStore();

  const { fullyQualifiedName } = column;

  const isColumnTraced = tracedColumns.has(fullyQualifiedName ?? '');

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedColumn(fullyQualifiedName ?? '');
    },
    [fullyQualifiedName, setSelectedColumn]
  );

  const handleMouseEnter = useCallback(() => {
    if (selectedColumn) {
      return;
    }
    onColumnMouseEnter(fullyQualifiedName ?? '');
  }, [selectedColumn, fullyQualifiedName, onColumnMouseEnter]);

  const handleMouseLeave = useCallback(() => {
    if (selectedColumn) {
      return;
    }
    setTracedColumns(new Set());
  }, [selectedColumn, setTracedColumns]);

  const columnNameContentRender = useMemo(
    () => getColumnNameContent(column, isLoading),
    [column, isLoading]
  );

  const handles = useMemo(
    () =>
      isEditMode
        ? getColumnHandle(
            EntityLineageNodeType.DEFAULT,
            isConnectable,
            'lineage-column-node-handle',
            fullyQualifiedName ?? ''
          )
        : null,
    [isEditMode, isConnectable, fullyQualifiedName]
  );

  return (
    <div
      className={classNames(`custom-node-column-container ${className}`, {
        'custom-node-header-column-tracing': isColumnTraced,
      })}
      data-testid={`column-${fullyQualifiedName}`}
      style={{
        paddingLeft: depth * DEPTH_INDENT_PX + 8, // 8px is base padding
      }}
      onClick={handleClick}
      onMouseDown={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}>
      {handles}
      <div className="custom-node-column-row">
        <div className="custom-node-name-container">
          {columnNameContentRender}
        </div>

        {'constraint' in column && column.constraint && (
          <div
            className={
              showDataObservabilitySummary
                ? 'custom-node-constraint text-left'
                : 'custom-node-constraint text-right'
            }>
            {column.constraint}
          </div>
        )}
        {showDataObservabilitySummary && (
          <div className="custom-node-summary">
            <TestSuiteSummaryWidget
              isLoading={isLoading}
              size="small"
              summary={summary}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const ColumnContent = memo(
  ColumnContentInner,
  (prev, next) =>
    prev.column === next.column &&
    prev.isConnectable === next.isConnectable &&
    prev.isLoading === next.isLoading &&
    prev.showDataObservabilitySummary === next.showDataObservabilitySummary &&
    prev.summary === next.summary &&
    prev.depth === next.depth &&
    prev.className === next.className
);

export function getNodeClassNames({
  isSelected,
  showDqTracing,
  isTraced,
  isBaseNode,
  isChildrenListExpanded,
}: {
  isSelected: boolean;
  showDqTracing: boolean;
  isTraced: boolean;
  isBaseNode: boolean;
  isChildrenListExpanded: boolean;
}) {
  return classNames(
    'lineage-node p-0',
    isSelected ? 'custom-node-header-active' : 'custom-node-header-normal',
    {
      'data-quality-failed-custom-node-header': showDqTracing,
      'custom-node-header-tracing': isTraced,
      'lineage-base-node': isBaseNode,
      'columns-expanded': isChildrenListExpanded,
    }
  );
}
