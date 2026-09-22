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
import { mergeAttributes, Node } from '@tiptap/core';
import { ADMONITION_TYPES } from '../../../constants/BlockEditor.constants';

const AdmonitionNode = Node.create({
  name: 'admonition',

  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: (element) => {
          const type = element.dataset.admonition ?? 'note';

          return (ADMONITION_TYPES as readonly string[]).includes(type)
            ? type
            : 'note';
        },
        renderHTML: (attributes) => ({
          'data-admonition': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-admonition]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `admonition admonition-${node.attrs.type}`,
      }),
      0,
    ];
  },
});

export default AdmonitionNode;
