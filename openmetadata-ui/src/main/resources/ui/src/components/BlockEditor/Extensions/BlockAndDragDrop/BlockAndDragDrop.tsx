/*
 *  Copyright 2023 Collate.
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
import { Extension } from '@tiptap/core';
import { BlockAndDragHandle } from './BlockAndDragHandle';

export interface BlockAndDragHandleOptions {
  /**
   * The width of the drag handle
   */
  dragHandleWidth: number;
  /**
   * The width of the drag handle
   */
  blockHandleWidth: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DragAndDropOptions {}

const DragAndDrop = Extension.create<DragAndDropOptions>({
  name: 'dragAndDrop',

  addProseMirrorPlugins() {
    return [
      BlockAndDragHandle({
        dragHandleWidth: 24,
        blockHandleWidth: 24,
      }),
    ];
  },
});

export default DragAndDrop;
