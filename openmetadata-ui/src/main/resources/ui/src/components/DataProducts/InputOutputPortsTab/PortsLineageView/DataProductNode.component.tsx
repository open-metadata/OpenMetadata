/*
 *  Copyright 2025 Collate.
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

import { Box, Typography } from '@mui/material';
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { getEntityName } from '../../../../utils/EntityUtils';
import './PortsLineageView.style.less';
import { DataProductNodeProps } from './PortsLineageView.types';

const DataProductNode = memo(({ data }: DataProductNodeProps) => {
  const { dataProduct } = data;

  return (
    <Box
      className="data-product-center-node"
      data-testid="data-product-center-node">
      <Handle
        className="lineage-node-handle"
        id={`${dataProduct.id}-left`}
        position={Position.Left}
        type="target"
      />
      <Handle
        className="lineage-node-handle"
        id={`${dataProduct.id}-right`}
        position={Position.Right}
        type="source"
      />

      <Box className="data-product-badge">
        <DataProductIcon height={12} width={12} />
        Data Product
      </Box>

      <Box className="data-product-content">
        <Box className="data-product-icon-container">
          <DataProductIcon height={24} width={24} />
        </Box>
        <Typography
          className="data-product-name"
          title={getEntityName(dataProduct)}>
          {getEntityName(dataProduct)}
        </Typography>
      </Box>
    </Box>
  );
});

DataProductNode.displayName = 'DataProductNode';

export default DataProductNode;
