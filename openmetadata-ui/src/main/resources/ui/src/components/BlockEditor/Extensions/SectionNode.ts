/*
 *  Copyright 2025 Collate.
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

const SectionNode = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      'data-id': {
        default: null,
        parseHTML: (element) => element.dataset.id,
        renderHTML: (attributes) => {
          if (!attributes['data-id']) {
            return {};
          }

          return { 'data-id': attributes['data-id'] };
        },
      },
      'data-highlighted': {
        default: 'false',
        parseHTML: (element) => element.dataset.highlighted ?? 'false',
        renderHTML: (attributes) => ({
          'data-highlighted': attributes['data-highlighted'],
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', HTMLAttributes, 0];
  },
});

export default SectionNode;
