/*
 *  Copyright 2026 Collate.
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

import type { NodeData } from '@antv/g6';
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityIcon } from '../../../utils/TableUtils';
import './custom-node.less';

export interface CustomNodeProps {
  nodeData: NodeData;
  nodeRenderKey: string;
  onSelect?: (keyboard: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

function CustomNode({
  nodeData,
  onSelect,
  onFocus,
  onBlur,
}: Readonly<CustomNodeProps>) {
  const { t } = useTranslation();
  const highlighted = Boolean(nodeData.data?.highlighted);
  const dimmed = Boolean(nodeData.data?.dimmed);
  const colorMain = nodeData.data?.colorMain as string | undefined;
  const colorLight = nodeData.data?.colorLight as string | undefined;
  const label = nodeData.data?.label as string;
  const type = nodeData.data?.type as string;

  return (
    <Button
      noTextPadding
      aria-label={t('label.kg-node-description', {
        name: label,
        type,
        level: nodeData.data?.level ?? 1,
      })}
      className={classNames('knowledge-graph-custom-node', {
        highlighted,
        dimmed,
      })}
      color="secondary"
      data-level={nodeData.data?.level}
      data-node-id={nodeData.id}
      data-testid={`node-${label}`}
      style={colorMain ? { borderLeftColor: colorMain } : undefined}
      title={label}
      onBlur={onBlur}
      onFocus={onFocus}
      onPress={(event) => onSelect?.(event.pointerType === 'keyboard')}>
      <Box align="center" className="tw:overflow-hidden" gap={2}>
        <Box
          align="center"
          className="node-icon"
          justify="center"
          style={colorMain ? { color: colorMain } : undefined}>
          {getEntityIcon(type, '', {
            width: 12,
            height: 12,
          })}
        </Box>
        <Typography ellipsis data-testid="label" weight="semibold">
          {label}
        </Typography>
      </Box>
      <Typography
        className="asset-type-tag"
        data-testid="type-tag"
        size="text-xs"
        style={
          colorMain && colorLight
            ? { color: colorMain, backgroundColor: colorLight, border: 'none' }
            : undefined
        }>
        {type}
      </Typography>
    </Button>
  );
}

// The G6 node object is mutable and can be updated in place.
// In a custom memo comparator, prev.nodeData.data and next.nodeData.data
// can end up reading the same already-mutated object
// Hence adding nodeRenderKey which is derived from nodeData but is a string
// and won't be affected by mutations to the nodeData object
export default React.memo(
  CustomNode,
  (prev, next) => prev.nodeRenderKey === next.nodeRenderKey
);
