/*
 *  Copyright 2024 Collate.
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

import { Tag } from 'antd';
import classNames from 'classnames';
import React, { memo, useMemo } from 'react';
import { EdgeProps } from 'reactflow';
import { RELATION_COLORS } from './OntologyExplorer.constants';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const ARROW_OFFSET = 2;

const getNodeBorderIntersection = (
  centerX: number,
  centerY: number,
  targetX: number,
  targetY: number,
  halfWidth: number,
  halfHeight: number
): { x: number; y: number } => {
  const dx = targetX - centerX;
  const dy = targetY - centerY;

  if (dx === 0 && dy === 0) {
    return { x: centerX, y: centerY };
  }

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let t: number;
  if (absDx * halfHeight > absDy * halfWidth) {
    t = halfWidth / absDx;
  } else {
    t = halfHeight / absDy;
  }

  return {
    x: centerX + dx * t,
    y: centerY + dy * t,
  };
};

const getStraightPath = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): [string, number, number, number, number, number, number] => {
  const halfWidth = NODE_WIDTH / 2;
  const halfHeight = NODE_HEIGHT / 2;

  const sourceIntersect = getNodeBorderIntersection(
    sourceX,
    sourceY,
    targetX,
    targetY,
    halfWidth,
    halfHeight
  );

  const targetIntersect = getNodeBorderIntersection(
    targetX,
    targetY,
    sourceX,
    sourceY,
    halfWidth,
    halfHeight
  );

  const dx = targetIntersect.x - sourceIntersect.x;
  const dy = targetIntersect.y - sourceIntersect.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  const startX = sourceIntersect.x;
  const startY = sourceIntersect.y;
  let endX = targetIntersect.x;
  let endY = targetIntersect.y;

  if (len > ARROW_OFFSET * 2) {
    const nx = dx / len;
    const ny = dy / len;
    endX = targetIntersect.x - nx * ARROW_OFFSET;
    endY = targetIntersect.y - ny * ARROW_OFFSET;
  }

  const path = `M ${startX} ${startY} L ${endX} ${endY}`;
  const labelX = (startX + endX) / 2;
  const labelY = (startY + endY) / 2;

  return [path, labelX, labelY, startX, startY, endX, endY];
};

export interface OntologyEdgeData {
  relationType: string;
  inverseRelationType?: string;
  isBidirectional: boolean;
  isHighlighted: boolean;
  showLabels: boolean;
  color: string;
}

export { RELATION_COLORS } from './OntologyExplorer.constants';

const OntologyEdge: React.FC<EdgeProps<OntologyEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  data,
  selected,
}) => {
  const {
    relationType,
    inverseRelationType,
    isBidirectional,
    isHighlighted,
    showLabels,
    color,
  } = data || {};

  const [edgePath, labelX, labelY] = useMemo(() => {
    const result = getStraightPath(sourceX, sourceY, targetX, targetY);

    return [result[0], result[1], result[2]] as [string, number, number];
  }, [sourceX, sourceY, targetX, targetY]);

  const relationColor = useMemo(() => {
    if (color) {
      return color;
    }

    return (
      RELATION_COLORS[relationType ?? 'default'] ?? RELATION_COLORS.default
    );
  }, [relationType, color]);

  const edgeStyle = useMemo(() => {
    return {
      ...style,
      stroke: relationColor,
      strokeWidth: isHighlighted || selected ? 2.5 : 1.5,
      opacity: isHighlighted || selected ? 1 : 0.8,
    };
  }, [style, isHighlighted, selected, relationColor]);

  const showLabel = showLabels && relationType;

  const displayLabel = useMemo(() => {
    if (isBidirectional && inverseRelationType) {
      return `${relationType} / ${inverseRelationType}`;
    }

    return relationType;
  }, [relationType, inverseRelationType, isBidirectional]);

  const labelWidth = isBidirectional ? 140 : 90;

  return (
    <>
      <defs>
        <marker
          id={`arrow-${id}`}
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto"
          refX="8"
          refY="4"
          viewBox="0 0 8 8">
          <path d="M0,0 L8,4 L0,8 z" fill={relationColor} />
        </marker>
        {isBidirectional && (
          <marker
            id={`arrow-start-${id}`}
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            orient="auto-start-reverse"
            refX="0"
            refY="4"
            viewBox="0 0 8 8">
            <path d="M8,0 L0,4 L8,8 z" fill={relationColor} />
          </marker>
        )}
      </defs>
      <path
        className={classNames('react-flow__edge-path ontology-flow-edge', {
          'ontology-flow-edge--highlighted': isHighlighted,
          'ontology-flow-edge--selected': selected,
        })}
        d={edgePath}
        id={id}
        markerEnd={`url(#arrow-${id})`}
        markerStart={isBidirectional ? `url(#arrow-start-${id})` : undefined}
        style={edgeStyle}
      />
      {showLabel && (isHighlighted || selected) && (
        <foreignObject
          className="ontology-flow-edge-label-container"
          height={20}
          width={labelWidth}
          x={labelX - labelWidth / 2}
          y={labelY - 10}>
          <Tag
            className={classNames('ontology-flow-edge-label', {
              'ontology-flow-edge-label--highlighted':
                isHighlighted || selected,
            })}
            color={relationColor}
            style={{
              fontSize: 9,
              lineHeight: '14px',
              padding: '1px 4px',
              margin: 0,
              maxWidth: labelWidth,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
            {displayLabel}
          </Tag>
        </foreignObject>
      )}
    </>
  );
};

export default memo(OntologyEdge);
