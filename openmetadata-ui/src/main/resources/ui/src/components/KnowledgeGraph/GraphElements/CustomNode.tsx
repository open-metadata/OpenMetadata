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

import { NodeData } from '@antv/g6';
import { Box, Typography } from '@openmetadata/ui-core-components';
import { getEntityIcon } from '../../../utils/TableUtils';
import './custom-node.less';

export interface CustomNodeProps {
  nodeData: NodeData;
}

function CustomNode({ nodeData }: Readonly<CustomNodeProps>) {
  const highlighted = Boolean(nodeData.data?.highlighted);
  const colorMain = nodeData.data?.colorMain as string | undefined;
  const colorLight = nodeData.data?.colorLight as string | undefined;

  return (
    <div
      className={`knowledge-graph-custom-node${
        highlighted ? ' highlighted' : ''
      }`}
      data-node-id={nodeData.id}
      data-testid={`node-${nodeData.data?.label as string}`}>
      <Box align="center" className="tw:overflow-hidden" gap={2}>
        <Box align="center" className="tw:text-tertiary" justify="center">
          {getEntityIcon(nodeData.data?.type as string, '', {
            width: 12,
            height: 12,
          })}
        </Box>
        <Typography
          data-testid="label"
          ellipsis={{
            tooltip: nodeData.data?.label as string,
            rows: 1,
          }}
          weight="semibold">
          {nodeData.data?.label as string}
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
        {nodeData.data?.type as string}
      </Typography>
    </div>
  );
}

export default CustomNode;
