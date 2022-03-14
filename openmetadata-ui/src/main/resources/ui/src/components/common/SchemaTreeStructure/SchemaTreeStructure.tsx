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

import React, { CSSProperties, useCallback, useState } from 'react';
import './SchemaTreeStructure.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusCircle, faMinusCircle } from '@fortawesome/free-solid-svg-icons';

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
        <FontAwesomeIcon icon={faMinusCircle} />
      ) : (
        <FontAwesomeIcon icon={faPlusCircle} />
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
