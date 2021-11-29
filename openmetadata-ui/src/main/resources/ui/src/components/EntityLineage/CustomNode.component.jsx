import classNames from 'classnames';
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

export default CustomNode;
