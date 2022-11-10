/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { CSSProperties, Fragment, useEffect } from 'react';
import {
  Handle,
  HandleProps,
  NodeProps,
  Position,
  useUpdateNodeInternals,
} from 'reactflow';
import { EntityLineageNodeType } from '../../enums/entity.enum';
import { getNodeRemoveButton } from '../../utils/EntityLineageUtils';
import { getConstraintIcon } from '../../utils/TableUtils';
import { ModifiedColumn } from './EntityLineage.interface';

const handleStyles: CSSProperties = {
  width: '20%',
  height: '100%',
  borderRadius: '3px',
  position: 'absolute',
  background: 'transparent',
  border: 'none',
};

const getHandle = (
  nodeType: string,
  isConnectable: HandleProps['isConnectable'],
  id?: string
) => {
  if (nodeType === EntityLineageNodeType.OUTPUT) {
    return (
      <Fragment>
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Left}
          style={{ ...handleStyles, borderLeft: '5px solid #d9ceee', left: 0 }}
          type="target"
        />
      </Fragment>
    );
  } else if (nodeType === EntityLineageNodeType.INPUT) {
    return (
      <Fragment>
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Right}
          style={{
            ...handleStyles,
            borderRight: '5px solid #d9ceee',
            right: 0,
          }}
          type="source"
        />
      </Fragment>
    );
  } else if (nodeType === EntityLineageNodeType.NOT_CONNECTED) {
    return null;
  } else {
    return (
      <Fragment>
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Left}
          style={{
            ...handleStyles,
            left: 0,
            borderLeft: '5px solid #d9ceee',
          }}
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Right}
          style={{
            ...handleStyles,
            right: 0,
            borderRight: '5px solid #d9ceee',
          }}
          type="source"
        />
      </Fragment>
    );
  }
};

const CustomNode = (props: NodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const { data, type, isConnectable, selected, id } = props;
  /* eslint-disable-next-line */
  const {
    label,
    columns,
    removeNodeHandler,
    handleColumnClick,
    isEditMode,
    isExpanded,
    isTraced,
    selectedColumns = [],
  } = data;

  useEffect(() => {
    updateNodeInternals(id);
  }, [isEditMode, isExpanded]);

  return (
    <div className="nowheel custom-node">
      {/* Node label could be simple text or reactNode */}
      <div
        className={classNames(
          'custom-node-header',
          selected || data.selected
            ? 'custom-node-header-active'
            : 'custom-node-header-normal',
          { 'custom-node-header-tracing': isTraced }
        )}
        data-testid="node-label">
        {getHandle(type, isConnectable)}
        {label}{' '}
        {selected && isEditMode
          ? getNodeRemoveButton(() => {
              removeNodeHandler?.(props);
            })
          : null}
      </div>

      {isExpanded && (
        <div
          className={classNames(
            'custom-node-column-lineage',
            selected || isTraced
              ? 'custom-node-column-lineage-active'
              : 'custom-node-column-lineage-normal',
            {
              'p-y-sm': !isEmpty(columns),
            }
          )}>
          <section className="p-x-sm" id="table-columns">
            <div className="custom-node-column-lineage-body">
              {(Object.values(columns || {}) as ModifiedColumn[])?.map(
                (column, index) => {
                  const isColumnTraced = selectedColumns.includes(
                    column.fullyQualifiedName
                  );

                  return (
                    <div
                      className={classNames(
                        'custom-node-column-container',
                        isColumnTraced
                          ? 'custom-node-header-tracing'
                          : 'custom-node-column-lineage-normal tw-bg-white'
                      )}
                      data-testid="column"
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleColumnClick(column.fullyQualifiedName);
                      }}>
                      {getHandle(
                        column.type,
                        isConnectable,
                        column.fullyQualifiedName
                      )}
                      {getConstraintIcon(column.constraint, 'tw-')}
                      <p className="m-0">{column.name}</p>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CustomNode;
