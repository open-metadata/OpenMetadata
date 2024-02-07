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
import { Node } from '@tiptap/core';
import { Image } from './image';

describe('Image', () => {
  it('should create node', () => {
    const imageNode = Image;

    expect(imageNode).toBeInstanceOf(Node);
  });

  it('should have correct configuration', () => {
    const imageNode = Image;

    expect(imageNode.config.name).toEqual('image');
    expect(imageNode.config.defaultOptions).toEqual({});
    expect(imageNode.config.selectable).toEqual(false);
    expect(imageNode.config.draggable).toEqual(true);
  });

  it('should have correct methods', () => {
    const imageNode = Image;

    expect(imageNode.config.addOptions).toBeInstanceOf(Function);
    expect(imageNode.config.inline).toBeInstanceOf(Function);
    expect(imageNode.config.group).toBeInstanceOf(Function);
    expect(imageNode.config.addAttributes).toBeInstanceOf(Function);
    expect(imageNode.config.parseHTML).toBeInstanceOf(Function);
    expect(imageNode.config.renderHTML).toBeInstanceOf(Function);
    expect(imageNode.config.addNodeView).toBeInstanceOf(Function);
    expect(imageNode.config.addCommands).toBeInstanceOf(Function);
    expect(imageNode.config.addInputRules).toBeInstanceOf(Function);
  });

  it('should have the htmlAttributes', () => {
    const imageNode = Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'image',
      },
    });

    expect(imageNode.options).toEqual({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'image',
      },
    });
  });
});
