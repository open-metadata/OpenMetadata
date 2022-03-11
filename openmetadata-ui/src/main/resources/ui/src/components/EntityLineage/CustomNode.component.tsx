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
import { Handle, HandleProps, Position } from 'react-flow-renderer';
import { getConstraintIcon } from '../../utils/TableUtils';

const handleStyles = { borderRadius: '50%', position: 'absolute', top: 10 };
const getHandle = (
  nodeType: string,
  isConnectable: HandleProps['isConnectable'],
  isNewNode = false
) => {
  if (nodeType === 'output') {
    return (
      <Handle
        isConnectable={isConnectable}
        position={Position.Left}
        style={{ ...handleStyles, left: '-14px' } as CSSProperties}
        type="target"
      />
    );
  } else if (nodeType === 'input') {
    return (
      <Handle
        isConnectable={isConnectable}
        position={Position.Right}
        style={{ ...handleStyles, right: '-14px' } as CSSProperties}
        type="source"
      />
    );
  } else {
    return (
      <Fragment>
        <Handle
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
      </Fragment>
    );
  }
};

/* eslint-disable-next-line */
const CustomNode = (props: any) => {
  /* eslint-disable-next-line */
  const { data, type, isConnectable } = props;
  /* eslint-disable-next-line */
  const { label, columns, isNewNode } = data;

  return (
    <div className="tw-relative nowheel ">
      {getHandle(type, isConnectable, isNewNode)}
      {/* Node label could be simple text or reactNode */}
      <div className={classNames('tw-px-2')}>{label}</div>

      {columns?.length ? <hr className="tw-my-2 tw--mx-3" /> : null}
      <section
        className={classNames('tw--mx-3 tw-px-3', {
          'tw-h-36 tw-overflow-y-auto': columns?.length,
        })}
        id="table-columns">
        <div className="tw-flex tw-flex-col tw-gap-y-1 tw-relative">
          {columns?.map(
            (c: { name: string; constraint: string }, i: number) => (
              <Fragment key={i}>
                <div
                  className="tw-p-1 tw-rounded tw-border tw-text-grey-body"
                  key={c.name}>
                  {getConstraintIcon(c.constraint, 'tw-')}
                  {c.name}
                </div>
              </Fragment>
            )
          )}
        </div>
      </section>
    </div>
  );
};

export default CustomNode;
