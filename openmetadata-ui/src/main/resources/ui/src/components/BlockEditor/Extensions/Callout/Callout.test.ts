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
import { Callout } from './Callout';

describe('Callout', () => {
  it('should create node', () => {
    const calloutNode = Callout;

    expect(calloutNode).toBeInstanceOf(Node);
  });

  it('should have correct configuration', () => {
    const calloutNode = Callout;

    expect(calloutNode.config.name).toEqual('callout');
    expect(calloutNode.config.content).toEqual('block+');
    expect(calloutNode.config.defaultOptions).toEqual({});
    expect(calloutNode.config.group).toEqual('block');
    expect(calloutNode.config.defining).toEqual(true);
    expect(calloutNode.config.draggable).toEqual(true);
  });

  it('should have correct methods', () => {
    const calloutNode = Callout;

    expect(calloutNode.config.addAttributes).toBeInstanceOf(Function);
    expect(calloutNode.config.parseHTML).toBeInstanceOf(Function);
    expect(calloutNode.config.renderHTML).toBeInstanceOf(Function);
    expect(calloutNode.config.addNodeView).toBeInstanceOf(Function);
    expect(calloutNode.config.addCommands).toBeInstanceOf(Function);
    expect(calloutNode.config.addKeyboardShortcuts).toBeInstanceOf(Function);
    expect(calloutNode.config.addInputRules).toBeInstanceOf(Function);
  });

  it('should have the htmlAttributes', () => {
    const calloutNode = Callout.configure({
      HTMLAttributes: {
        calloutType: 'note',
      },
    });

    expect(calloutNode.options.HTMLAttributes).toEqual({
      calloutType: 'note',
    });
  });
});
