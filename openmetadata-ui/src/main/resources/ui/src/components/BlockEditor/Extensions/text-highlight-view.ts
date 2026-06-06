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

export default Node.create({
  name: 'textHighLightView',
  content: 'inline*',
  group: 'inline',
  inline: true,

  addAttributes() {
    return {
      class: {
        default: '',
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => {
          if (!attributes.class) {
            return {};
          }

          return {
            class: attributes.class,
          };
        },
      },
      'data-testid': {
        default: '',
        parseHTML: (element) => element.dataset.testid,
        renderHTML: (attributes) => {
          if (!attributes['data-testid']) {
            return {};
          }

          return {
            'data-testid': attributes['data-testid'],
          };
        },
      },
      'data-highlight': {
        default: true,
        parseHTML: (element) => element.dataset.highlight,
        renderHTML: (attributes) => {
          if (!attributes['data-highlight']) {
            return {};
          }

          return {
            'data-highlight': attributes['data-highlight'],
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-highlight]',
      },
      {
        tag: 'span.text-highlighter',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const textHighlightNode = document.createElement('span');

    Object.keys(HTMLAttributes).forEach((key) => {
      textHighlightNode.setAttribute(key, HTMLAttributes[key]);
    });

    textHighlightNode.dataset.highlight = 'true';
    textHighlightNode.innerHTML = node.textContent;

    return {
      dom: textHighlightNode,
    };
  },
});
