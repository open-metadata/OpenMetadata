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
import { RefObject } from 'react';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { EdgeFromToData } from '../../../interface/lineage.interface';

export interface LineageEditRequest {
  nodeId: string;
  direction: LineageDirection;
  columnFqn?: string;
  triggerRef: RefObject<HTMLElement>;
}

export interface AddLineageSelection {
  entity: EdgeFromToData;
  columnFqn?: string;
}

export interface AddLineagePopoverProps {
  request?: LineageEditRequest;
  excludeEntityId?: string;
  onClose: () => void;
  onSubmit: (selection: AddLineageSelection) => Promise<boolean>;
}
