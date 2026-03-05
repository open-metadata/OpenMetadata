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

import { BookOpen01, File01 } from '@untitledui/icons';
import classNames from 'classnames';
import React, { memo, useCallback } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { OntologyNode as OntologyNodeType } from './OntologyExplorer.interface';

export interface OntologyNodeData {
  node: OntologyNodeType;
  isSelected: boolean;
  isHighlighted: boolean;
  isConnected: boolean;
  glossaryColor: string;
  nodeHeight?: number;
  onClick: (nodeId: string) => void;
  onDoubleClick: (nodeId: string) => void;
}

const OntologyNode: React.FC<NodeProps<OntologyNodeData>> = ({ data }) => {
  const {
    node,
    isSelected,
    isHighlighted,
    isConnected,
    glossaryColor,
    nodeHeight,
    onClick,
    onDoubleClick,
  } = data;

  const isGlossary = node.type === 'glossary';
  const displayLabel = node.originalLabel ?? node.label;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(node.id);
    },
    [node.id, onClick]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleClick(node.id);
    },
    [node.id, onDoubleClick]
  );

  const nodeClassName = classNames('ontology-flow-node', {
    'ontology-flow-node--selected': isSelected,
    'ontology-flow-node--highlighted': isHighlighted && !isSelected,
    'ontology-flow-node--connected':
      isConnected && !isSelected && !isHighlighted,
    'ontology-flow-node--glossary': isGlossary,
    'ontology-flow-node--term': !isGlossary,
    'ontology-flow-node--isolated': node.type === 'glossaryTermIsolated',
  });

  return (
    <div
      className={nodeClassName}
      data-testid={`ontology-node-${node.id}`}
      style={{
        borderColor: isSelected || isHighlighted ? glossaryColor : undefined,
        boxShadow: isSelected
          ? `0 0 0 2px ${glossaryColor}40`
          : isHighlighted
          ? `0 0 0 1px ${glossaryColor}30`
          : undefined,
        minHeight: nodeHeight ? `${nodeHeight}px` : undefined,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}>
      <Handle
        className="ontology-flow-handle"
        id="center"
        isConnectable={false}
        position={Position.Top}
        style={{
          opacity: 0,
          pointerEvents: 'none',
          left: '50%',
          top: '50%',
        }}
        type="source"
      />
      <Handle
        className="ontology-flow-handle"
        id="center"
        isConnectable={false}
        position={Position.Top}
        style={{
          opacity: 0,
          pointerEvents: 'none',
          left: '50%',
          top: '50%',
        }}
        type="target"
      />

      <div className="ontology-flow-node__content">
        <div
          className="ontology-flow-node__icon"
          style={{ backgroundColor: `${glossaryColor}15` }}>
          {isGlossary ? (
            <BookOpen01 size={14} style={{ color: glossaryColor }} />
          ) : (
            <File01 size={14} style={{ color: glossaryColor }} />
          )}
        </div>

        <div className="ontology-flow-node__info">
          <span
            className="ontology-flow-node__label"
            style={{ fontWeight: isGlossary ? 600 : undefined }}
            title={displayLabel}>
            {displayLabel}
          </span>

          {node.group && !isGlossary && (
            <span className="ontology-flow-node__group" title={node.group}>
              {node.group}
            </span>
          )}
        </div>

        {isGlossary && (
          <div
            className="ontology-flow-node__badge"
            style={{ backgroundColor: glossaryColor }}>
            G
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(OntologyNode);
