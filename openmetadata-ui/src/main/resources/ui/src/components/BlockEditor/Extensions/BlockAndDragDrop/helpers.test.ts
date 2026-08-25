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
import { EditorView } from '@tiptap/pm/view';
import { absoluteRect, nodeDOMAtCoords, nodePosAtDOM } from './helpers';

describe('helpers', () => {
  it('absoluteRect should return the correct value', () => {
    const node = document.createElement('div');
    const data = node.getBoundingClientRect();

    expect(absoluteRect(node)).toEqual({
      top: data.top,
      left: data.left,
      width: data.width,
      right: data.right,
    });
  });

  it('nodeDOMAtCoords should return the correct value', () => {
    const coords = { x: 0, y: 0 };
    const node = document.createElement('div');
    const elementsFromPoint = jest.fn().mockReturnValue([node]);
    document.elementsFromPoint = elementsFromPoint;

    expect(nodeDOMAtCoords(coords)).toBeUndefined();
    expect(elementsFromPoint).toHaveBeenCalledWith(coords.x, coords.y);
  });

  it('nodePosAtDOM should return the correct value', () => {
    const node = document.createElement('div');
    const view = {
      posAtCoords: jest.fn().mockReturnValue({ inside: 2 }),
    } as unknown as EditorView;

    expect(nodePosAtDOM(node, view)).toBe(2);
  });
});
