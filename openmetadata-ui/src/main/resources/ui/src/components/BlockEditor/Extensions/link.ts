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
import {
  InputRule,
  markInputRule,
  markPasteRule,
  PasteRule,
} from '@tiptap/core';
import TipTapLinkExtension from '@tiptap/extension-link';
import {
  LINK_INPUT_REGEX,
  LINK_PASTE_REGEX,
} from '../../../constants/BlockEditor.constants';

const linkInputRule = (config: Parameters<typeof markInputRule>[0]) => {
  const defaultMarkInputRule = markInputRule(config);

  return new InputRule({
    find: config.find,
    handler(props) {
      const { tr } = props.state;

      defaultMarkInputRule.handler(props);
      tr.setMeta('preventAutolink', true);
    },
  });
};

const linkPasteRule = (config: Parameters<typeof markPasteRule>[0]) => {
  const defaultMarkPasteRule = markPasteRule(config);

  return new PasteRule({
    find: config.find,
    handler(props) {
      const { tr } = props.state;

      defaultMarkPasteRule.handler(props);
      tr.setMeta('preventAutolink', true);
    },
  });
};

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
      'data-textcontent': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-textcontent'),
        renderHTML: (attributes) => {
          if (!attributes['data-textcontent']) {
            return {};
          }

          return {
            'data-textcontent': attributes['data-textcontent'],
          };
        },
      },
    };
  },
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      linkInputRule({
        find: LINK_INPUT_REGEX,
        type: this.type,
        getAttributes(match) {
          return {
            title: match.pop()?.trim(),
            href: match.pop()?.trim(),
          };
        },
      }),
    ];
  },
  addPasteRules() {
    return [
      ...(this.parent?.() ?? []),
      linkPasteRule({
        find: LINK_PASTE_REGEX,
        type: this.type,
        getAttributes(match) {
          return {
            title: match.pop()?.trim(),
            href: match.pop()?.trim(),
          };
        },
      }),
    ];
  },
});
