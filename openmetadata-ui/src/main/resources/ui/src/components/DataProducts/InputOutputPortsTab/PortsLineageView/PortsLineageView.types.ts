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

import { NodeProps } from 'reactflow';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';

export interface PortsLineageViewProps {
  dataProduct: DataProduct;
  inputPortsData: SearchedDataProps['data'];
  outputPortsData: SearchedDataProps['data'];
  assetCount: number;
  isFullScreen?: boolean;
  height?: number;
  onToggleFullScreen?: () => void;
  onPortClick?: (port: SearchedDataProps['data'][number]['_source']) => void;
}

export interface PortNodeData {
  label: string;
  port: SearchedDataProps['data'][number]['_source'];
  isInputPort: boolean;
  handleId: string;
}

export interface DataProductNodeData {
  dataProduct: DataProduct;
}

export type PortNodeProps = NodeProps<PortNodeData>;
export type DataProductNodeProps = NodeProps<DataProductNodeData>;
