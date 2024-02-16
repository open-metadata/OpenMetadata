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
import { Extension } from '@tiptap/core';
import DragAndDrop from './BlockAndDragDrop';

const BlockAndDragHandle = jest.fn();

jest.mock('./BlockAndDragHandle', () => ({
  BlockAndDragHandle,
}));

describe('DragAndDrop', () => {
  it('should be an instance of Extension', () => {
    expect(DragAndDrop).toBeInstanceOf(Extension);
  });

  it('should have the correct name', () => {
    expect(DragAndDrop.name).toStrictEqual('dragAndDrop');
  });

  it('should have the correct options', () => {
    DragAndDrop.configure({
      dragHandleWidth: 24,
      blockHandleWidth: 24,
    });

    expect(DragAndDrop.child?.options).toStrictEqual({
      dragHandleWidth: 24,
      blockHandleWidth: 24,
    });
  });

  it('should have the correct config', () => {
    expect(DragAndDrop.config).toStrictEqual({
      name: 'dragAndDrop',
      defaultOptions: {},
      addProseMirrorPlugins: expect.anything(),
    });
  });
});
