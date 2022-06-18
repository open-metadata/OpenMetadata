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
import React, { CSSProperties, Fragment } from 'react';
import { Handle, HandleProps, NodeProps, Position } from 'react-flow-renderer';
import { Column } from '../../generated/entity/data/table';
import { getNodeRemoveButton } from '../../utils/EntityLineageUtils';
import { getConstraintIcon } from '../../utils/TableUtils';

const handleStyles = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  position: 'absolute',
  top: 10,
};

const getHandle = (
  nodeType: string,
  isConnectable: HandleProps['isConnectable'],
  isNewNode = false,
  id?: string
) => {
  const getLeftRightHandleStyles = () => {
    return {
      opacity: 0,
      borderRadius: '0px',
      height: '162%',
    };
  };

  const getTopBottomHandleStyles = () => {
    return {
      opacity: 0,
      borderRadius: '0px',
      width: '110%',
    };
  };

  if (nodeType === 'output') {
    return (
      <Fragment>
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Left}
          style={{ ...handleStyles, left: '-14px' } as CSSProperties}
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Left}
          style={{
            ...getLeftRightHandleStyles(),
            marginLeft: '-10px',
          }}
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Bottom}
          style={{
            ...getTopBottomHandleStyles(),
            marginBottom: '-6px',
          }}
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Top}
          style={{
            ...getTopBottomHandleStyles(),
            marginTop: '-6px',
          }}
          type="target"
        />
      </Fragment>
    );
  } else if (nodeType === 'input') {
    return (
      <Fragment>
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Right}
          style={{ ...handleStyles, right: '-14px' } as CSSProperties}
          type="source"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Right}
          style={{
            ...getLeftRightHandleStyles(),
            marginRight: '-10px',
          }}
          type="source"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Bottom}
          style={{
            ...getTopBottomHandleStyles(),
            marginBottom: '-6px',
          }}
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Top}
          style={{
            ...getTopBottomHandleStyles(),
            marginTop: '-6px',
          }}
          type="target"
        />
      </Fragment>
    );
  } else {
    return (
      <Fragment>
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Left}
          style={
            {
              ...handleStyles,
              left: '-14px',
              top: isNewNode ? 13 : handleStyles.top,
            } as CSSProperties
          }
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Right}
          style={
            {
              ...handleStyles,
              right: '-14px',
              top: isNewNode ? 13 : handleStyles.top,
            } as CSSProperties
          }
          type="source"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Left}
          style={{
            ...getLeftRightHandleStyles(),
            marginLeft: '-10px',
          }}
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Right}
          style={{
            ...getLeftRightHandleStyles(),
            marginRight: '-10px',
          }}
          type="source"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Bottom}
          style={{
            ...getTopBottomHandleStyles(),
            marginBottom: '-6px',
          }}
          type="target"
        />
        <Handle
          id={id}
          isConnectable={isConnectable}
          position={Position.Top}
          style={{
            ...getTopBottomHandleStyles(),
            marginTop: '-6px',
          }}
          type="target"
        />
      </Fragment>
    );
  }
};

const CustomNode = (props: NodeProps) => {
  const { data, type, isConnectable, selected } = props;
  /* eslint-disable-next-line */
  const { label, columns, isNewNode, removeNodeHandler, isEditMode } = data;

  return (
    <div className="tw-relative nowheel ">
      {/* Node label could be simple text or reactNode */}
      <div className={classNames('tw-px-2')} data-testid="node-label">
        {getHandle(type, isConnectable, isNewNode)}
        {label}{' '}
        {selected && isEditMode
          ? getNodeRemoveButton(() => {
              removeNodeHandler?.(props);
            })
          : null}
      </div>

      {columns?.length ? (
        <hr className="tw-my-2 tw--mx-3" data-testid="label-separator" />
      ) : null}
      <section
        className={classNames('tw--mx-3 tw-px-3', {
          // 'tw-h-36 tw-overflow-y-auto': !isEmpty(columns),
        })}
        id="table-columns">
        <div className="tw-flex tw-flex-col tw-gap-y-1 tw-relative">
          {(Object.values(columns || {}) as Column[])?.map((c, i) => (
            <Fragment key={i}>
              <div
                className="tw-p-1 tw-rounded tw-border tw-text-grey-body tw-relative"
                data-testid="column">
                {getHandle(
                  type,
                  isConnectable,
                  isNewNode,
                  c.fullyQualifiedName
                )}
                {getConstraintIcon(c.constraint, 'tw-')}
                {c.name}
              </div>
            </Fragment>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CustomNode;
