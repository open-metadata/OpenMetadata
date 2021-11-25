import React from 'react';
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
      <>
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
      </>
    );
  }
};

const CustomNode = (props) => {
  return (
    <div className="tw-relative">
      {getHandle(props.type, props.isConnectable)}
      <div
      // className="tw-mb-3 tw-px-2"
      >
        {props.data.label}
      </div>
      {/* <div className="tw-flex tw-flex-col tw-gap-y-1">
        {['column1', 'column1', 'column1', 'column1'].map((c) => (
          <p className="tw-p-2 tw-rounded tw-bg-tag">{c}</p>
        ))}
      </div> */}
    </div>
  );
};

export default CustomNode;
