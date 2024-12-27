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
import { Node } from '@tiptap/core';

export default Node.create({
  name: 'diffView',
  content: 'inline*',
  group: 'inline',
  inline: true,

  addAttributes() {
    return {
      class: {
        default: '',
      },
      'data-testid': {
        default: '',
        parseHTML: (element) => element.getAttribute('data-testid'),
        renderHTML: (attributes) => {
          if (!attributes['data-testid']) {
            return {};
          }

          return {
            'data-testid': attributes['data-testid'],
          };
        },
      },
      'data-diff': {
        default: true,
        parseHTML: (element) => element.getAttribute('data-diff'),
        renderHTML: (attributes) => {
          if (!attributes['data-diff']) {
            return {};
          }

          return {
            'data-diff': attributes['data-diff'],
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-diff]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const diffNode = document.createElement('span');

    Object.keys(HTMLAttributes).forEach((key) => {
      diffNode.setAttribute(key, HTMLAttributes[key]);
    });

    diffNode.setAttribute('data-diff', 'true');
    diffNode.innerHTML = node.textContent;

    return {
      dom: diffNode,
    };
  },
});
