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
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { Handle } from 'react-flow-renderer';

const handleStyles = { borderRadius: '50%', position: 'absolute', top: 10 };
const getHandle = (nodeType, isConnectable) => {
  if (nodeType === 'output') {
    return (
      <Handle
        isConnectable={isConnectable}
        position="left"
        style={{ ...handleStyles, left: '-14px' }}
        type="target"
      />
    );
  } else if (nodeType === 'input') {
    return (
      <Handle
        isConnectable={isConnectable}
        position="right"
        style={{ ...handleStyles, right: '-14px' }}
        type="source"
      />
    );
  } else {
    return (
      <Fragment>
        <Handle
          isConnectable={isConnectable}
          position="left"
          style={{ ...handleStyles, left: '-14px' }}
          type="target"
        />
        <Handle
          isConnectable={isConnectable}
          position="right"
          style={{ ...handleStyles, right: '-14px' }}
          type="source"
        />
      </Fragment>
    );
  }
};

const CustomNode = (props) => {
  /* eslint-disable-next-line */
  const { data, type, isConnectable } = props;
  /* eslint-disable-next-line */
  const { label, columns } = data;

  return (
    <div className="tw-relative nowheel ">
      {getHandle(type, isConnectable)}
      {/* Node label could be simple text or reactNode */}
      <div className={classNames('tw-px-2')}>{label}</div>

      {columns?.length ? <hr className="tw-my-2 tw--mx-3" /> : null}
      <section
        className={classNames('tw--mx-3 tw-px-3', {
          'tw-h-36 tw-overflow-y-auto': columns?.length,
        })}
        id="table-columns">
        <div className="tw-flex tw-flex-col tw-gap-y-1">
          {columns?.map((c) => (
            <p
              className="tw-p-1 tw-rounded tw-border tw-text-grey-body"
              key={c.name}>
              {c.name}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
};

CustomNode.propTypes = {
  type: PropTypes.string.isRequired,
  isConnectable: PropTypes.bool.isRequired,
  data: PropTypes.shape({
    label: PropTypes.string.isRequired,
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
      })
    ),
  }),
};

export default CustomNode;
