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
      <div className="entity-name-container">
        <div className="icon-container">
          {getEntityIcon(nodeData.data?.type as string, '', {
            width: 12,
            height: 12,
          })}
        </div>
        <div
          className="asset-name"
          data-testid="label"
          title={nodeData.data?.label as string}>
          {nodeData.data?.label as string}
        </div>
      </div>
      <div
        className="asset-type-tag"
        data-testid="type-tag"
        style={
          colorMain && colorLight
            ? { color: colorMain, backgroundColor: colorLight, border: 'none' }
            : undefined
        }>
        {nodeData.data?.type as string}
      </div>
    </div>
  );
}

export default CustomNode;
