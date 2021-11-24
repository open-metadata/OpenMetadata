import React, { CSSProperties, useCallback, useState } from 'react';
import './SchemaTreeStructure.css';

type Props = {
  positions?: Array<number>;
  name: string;
  type: string;
  fields?: Array<Props>;
  isCollapsed?: boolean;
};

export const getStyle = (type: string) => {
  const sharedStyles = {
    padding: '4px 8px',
    borderRadius: '5px',
    minWidth: '60px',
    textAlign: 'center',
    display: 'inline-block',
  };
  switch (type) {
    case 'double':
      return {
        backgroundColor: '#B02AAC33',
        color: '#B02AAC',
        ...sharedStyles,
      };

    case 'string':
      return {
        backgroundColor: '#51c41a33',
        color: '#51c41a',
        ...sharedStyles,
      };

    case 'int':
      return {
        backgroundColor: '#1890FF33',
        color: '#1890FF',
        ...sharedStyles,
      };

    default:
      return {
        backgroundColor: '#EEEAF8',
        ...sharedStyles,
      };
  }
};

const SchemaTreeStructure = ({
  name,
  type,
  fields,
  isCollapsed = false,
  // to track position of element [L0,L1,L2,...Ln]
  positions = [],
}: Props) => {
  const [showChildren, setShowChildren] = useState<boolean>(!isCollapsed);
  const flag = (fields ?? []).length > 0;

  const showChildrenHandler = useCallback(() => {
    setShowChildren(!showChildren);
  }, [showChildren, setShowChildren]);

  const getIcon = () => {
    return (
      flag &&
      (showChildren ? (
        <i className="fas fa-minus-circle" />
      ) : (
        <i className="fas fa-plus-circle" />
      ))
    );
  };

  return (
    <div
      className="field-wrapper"
      style={{ paddingLeft: flag ? '26px' : '0px' }}>
      <div
        className="field-child"
        style={{ marginLeft: flag ? '-26px' : '0px' }}>
        <p className="field-child-icon" onClick={showChildrenHandler}>
          {getIcon()}
        </p>
        <p className="field-label">
          <span style={getStyle(type) as CSSProperties}>{type}</span>
          <span className="field-label-name">{name}</span>
        </p>
      </div>
      {flag && showChildren && (
        <div className="child-fields-wrapper">
          {(fields ?? []).map((field, index) => (
            <SchemaTreeStructure
              isCollapsed
              key={index}
              positions={[...positions, index]}
              {...field}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SchemaTreeStructure;
