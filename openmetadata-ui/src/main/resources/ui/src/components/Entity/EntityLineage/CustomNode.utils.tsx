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
import { Button, Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { Fragment } from 'react';
import { Handle, HandleProps, HandleType, Position } from 'reactflow';
import { ReactComponent as MinusIcon } from '../../../assets/svg/control-minus.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-outlined.svg';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { Column } from '../../../generated/entity/data/table';
import { ColumnTestSummaryDefinition } from '../../../generated/tests/testCase';
import { encodeLineageHandles } from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getColumnDataTypeIcon } from '../../../utils/TableUtils';
import TestSuiteSummaryWidget from './TestSuiteSummaryWidget/TestSuiteSummaryWidget.component';

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

export const getExpandHandle = (
  direction: LineageDirection,
  onClickHandler: () => void
) => {
  return (
    <Button
      className={classNames(
        'absolute lineage-node-handle flex-center',
        direction === LineageDirection.Downstream
          ? 'react-flow__handle-right'
          : 'react-flow__handle-left'
      )}
      icon={
        <PlusIcon className="lineage-expand-icon" data-testid="plus-icon" />
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

export const getColumnContent = (
  column: Column,
  isColumnTraced: boolean,
  isConnectable: boolean,
  onColumnClick: (column: string) => void,
  showDataObservabilitySummary: boolean,
  isLoading: boolean,
  summary?: ColumnTestSummaryDefinition
) => {
  const { fullyQualifiedName } = column;

  return (
    <div
      className={classNames(
        'custom-node-column-container',
        isColumnTraced && 'custom-node-header-tracing',
        showDataObservabilitySummary && 'p-r-md'
      )}
      data-testid={`column-${fullyQualifiedName}`}
      key={fullyQualifiedName}
      onClick={(e) => {
        e.stopPropagation();
        onColumnClick(fullyQualifiedName ?? '');
      }}>
      {getColumnHandle(
        EntityLineageNodeType.DEFAULT,
        isConnectable,
        'lineage-column-node-handle',
        encodeLineageHandles(fullyQualifiedName ?? '')
      )}
      <Row gutter={24}>
        <Col
          className="custom-node-name-container"
          span={showDataObservabilitySummary ? 8 : 12}>
          <div className="custom-node-name-icon">
            {getColumnDataTypeIcon({
              dataType: column.dataType,
              width: '14px',
            })}
          </div>
          <Typography.Text
            className="custom-node-column-label"
            ellipsis={{ tooltip: true }}>
            {getEntityName(column)}
          </Typography.Text>
        </Col>

        <Col
          className={classNames(
            'custom-node-constraint',
            showDataObservabilitySummary ? 'text-left' : 'text-right'
          )}
          span={showDataObservabilitySummary ? 8 : 12}>
          {column.constraint}
        </Col>
        {showDataObservabilitySummary && (
          <Col span={8}>
            <TestSuiteSummaryWidget
              isLoading={isLoading}
              size="small"
              summary={summary}
            />
          </Col>
        )}
      </Row>
    </div>
  );
};
