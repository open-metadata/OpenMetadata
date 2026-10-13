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
import { LineageNodeType } from '../../../../interface/lineage.interface';

export interface NodeChildrenProps {
  node: LineageNodeType;
  isConnectable: boolean;
  isChildrenListExpanded: boolean;
  isOnlyShowColumnsWithLineageFilterActive?: boolean;
  onColumnHover?: (columnFqn?: string) => void;
  onColumnSelect?: (columnFqn?: string) => void;
}

// Re-exported because consumers outside this repository import it from this path.
export type { EntityChildren } from '../../../../interface/lineage.interface';
