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
import TipTapLinkExtension from '@tiptap/extension-link';

export const LinkExtension = TipTapLinkExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes['data-id']) {
            return {};
          }

          return {
            'data-id': attributes['data-id'],
          };
        },
      },

      'data-label': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes['data-label']) {
            return {};
          }

          return {
            'data-label': attributes['data-label'],
          };
        },
      },
      'data-entityType': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entityType'),
        renderHTML: (attributes) => {
          if (!attributes['data-entityType']) {
            return {};
          }

          return {
            'data-entityType': attributes['data-entityType'],
          };
        },
      },
      'data-fqn': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-fqn'),
        renderHTML: (attributes) => {
          if (!attributes['data-fqn']) {
            return {};
          }

          return {
            'data-fqn': attributes['data-fqn'],
          };
        },
      },
      'data-type': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML: (attributes) => {
          if (!attributes['data-type']) {
            return {};
          }

          return {
            'data-type': attributes['data-type'],
          };
        },
      },
    };
  },
});
