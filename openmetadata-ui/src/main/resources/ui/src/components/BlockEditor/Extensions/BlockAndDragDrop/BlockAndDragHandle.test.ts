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
import { Plugin } from '@tiptap/pm/state';
import { BlockAndDragHandle } from './BlockAndDragHandle';

const options = {
  dragHandleWidth: 50,
  blockHandleWidth: 50,
};

describe('BlockAndDragHandle', () => {
  it('should create plugin', () => {
    const plugin = BlockAndDragHandle(options);

    expect(plugin).toBeInstanceOf(Plugin);
  });

  it("should have the spec, props and getState of 'blockAndDragHandle'", () => {
    const plugin = BlockAndDragHandle(options);

    expect(plugin.spec).toBeDefined();
    expect(plugin.props).toBeDefined();
    expect(plugin.getState).toBeDefined();
  });

  it("should have the dom events of 'dragHandle' and 'blockHandle'", () => {
    const plugin = BlockAndDragHandle(options);

    expect(plugin.props.handleDOMEvents).toBeDefined();
    expect(plugin.props.handleDOMEvents?.dragstart).toBeDefined();
    expect(plugin.props.handleDOMEvents?.drop).toBeDefined();
    expect(plugin.props.handleDOMEvents?.dragend).toBeDefined();
  });
});
