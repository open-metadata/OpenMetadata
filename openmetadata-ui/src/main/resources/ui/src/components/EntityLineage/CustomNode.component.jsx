import classNames from 'classnames';
import React, { Fragment } from 'react';
import { Handle } from 'react-flow-renderer';

/* eslint-disable */
const handleStyles = { borderRadius: '50%', position: 'absolute', top: 10 };
const getHandle = (nodeType, isConnectable) => {
  if (nodeType === 'output') {
    return (
      <Handle
        isConnectable={isConnectable}
        type="target"
        position="left"
        style={{ ...handleStyles, left: '-14px' }}
      />
    );
  } else if (nodeType === 'input') {
    return (
      <Handle
        isConnectable={isConnectable}
        type="source"
        position="right"
        style={{ ...handleStyles, right: '-14px' }}
      />
    );
  } else {
    return (
      <Fragment>
        <Handle
          isConnectable={isConnectable}
          type="target"
          position="left"
          style={{ ...handleStyles, left: '-14px' }}
        />
        <Handle
          isConnectable={isConnectable}
          type="source"
          position="right"
          style={{ ...handleStyles, right: '-14px' }}
        />
      </Fragment>
    );
  }
};

const CustomNode = (props) => {
  const { data } = props;
  return (
    <div className="tw-relative nowheel">
      {getHandle(props.type, props.isConnectable)}
      {/* Node label could be simple text or reactNode */}
      <div
        className={classNames('tw-px-2', {
          'tw-mb-3': data.columns?.length,
        })}>
        {data.label}
      </div>

      <section
        className={classNames({
          'tw-h-36 tw-overflow-y-auto': data.columns?.length,
        })}
        id="table-columns">
        <div className="tw-flex tw-flex-col tw-gap-y-1">
          {data.columns?.map((c) => (
            <p className="tw-p-2 tw-rounded tw-bg-tag" key={c.name}>
              {c.name}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CustomNode;
