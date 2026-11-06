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
import { LayoutDropTarget } from './CustomPropertiesWidget.interface';

export interface DragItem {
  index: number;
}

export interface UseLayoutItemDragOptions {
  dragType: string;
  index: number;
  /** Items side by side compare the pointer on x, stacked items on y. */
  axis: 'x' | 'y';
  isDisabled?: boolean;
  onHover: (fromIndex: number, target: LayoutDropTarget) => void;
  onDragEnd: () => void;
}
