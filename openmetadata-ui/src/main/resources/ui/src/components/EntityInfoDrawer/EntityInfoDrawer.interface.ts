/*
 *  Copyright 2022 Collate.
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

import { Edge, Node } from 'reactflow';
import { SelectedNode } from '../EntityLineage/EntityLineage.interface';

export interface LineageDrawerProps {
  show: boolean;
  onCancel: () => void;
  selectedNode: SelectedNode;
  isMainNode: boolean;
}

export interface EdgeInfoDrawerInfo {
  edge: Edge;
  nodes: Node[];
  visible: boolean;
  onClose: () => void;
}
type InfoType = {
  key: string;
  value: string | undefined;
  link?: string;
};

export type EdgeInformationType = {
  sourceData?: InfoType;
  targetData?: InfoType;
  pipeline?: InfoType;
  sourceColumn?: InfoType;
  targetColumn?: InfoType;
  functionInfo?: InfoType;
};
