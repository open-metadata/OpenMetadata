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

import { ReactRenderer } from '@tiptap/react';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { isEmpty } from 'lodash';
import tippy, { Instance, Props } from 'tippy.js';
import { ExtensionRef } from '../components/BlockEditor/BlockEditor.interface';
import HandlebarsList, {
  HandlebarsItem,
} from '../components/BlockEditor/Extensions/handlebars/HandlebarsList';
import { DEFAULT_HELPERS } from '../constants/Handlebar.constants';

/**
 * Converts editor HTML to backend-compatible format by unwrapping handlebars blocks
 * @param html - The HTML output from editor.getHTML()
 * @returns HTML with handlebars blocks converted to plain text
 *
 * @example
 * Input:
 * <div class="om-handlebars-block">{{#if true }}</div>
 * <p>content</p>
 * <div class="om-handlebars-block">{{/if}}</div>
 *
 * Output:
 * {{#if true }}
 * <p>content</p>
 * {{/if}}
 */
export const serializeHandlebarsForBackend = (html: string): string => {
  let result = html.replace(
    /<div[^>]*class="[^"]*om-handlebars-block[^"]*"[^>]*>(.*?)<\/div>/gi,
    '$1'
  );

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = result;

  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;

      if (element.tagName === 'P') {
        const text = element.textContent || '';
        const handlebarsRegex = /^({{[^}]+}})$/;

        if (handlebarsRegex.test(text.trim())) {
          const textNode = document.createTextNode(text.trim());
          element.parentNode?.replaceChild(textNode, element);

          return;
        }
      }

      Array.from(node.childNodes).forEach(processNode);
    }
  };

  processNode(tempDiv);
  result = tempDiv.innerHTML;

  result = result.replace(/<br\s*\/?>/gi, '\n');

  return result;
};

/**
 * Parses backend HTML to editor-compatible format by wrapping handlebars syntax
 * @param html - The HTML from backend
 * @returns HTML with handlebars syntax wrapped in handlebarsBlock divs
 *
 * @example
 * Input:
 * {{#if true }}
 * <p>content</p>
 * {{/if}}
 *
 * Output:
 * <div class="om-handlebars-block">{{#if true }}</div>
 * <p>content</p>
 * <div class="om-handlebars-block">{{/if}}</div>
 */
export const parseHandlebarsFromBackend = (html: string): string => {
  if (!html || html.includes('om-handlebars-block')) {
    return html;
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const handlebarsRegex = /({{[^}]+}})/g;
      const matches = text.match(handlebarsRegex);

      if (matches) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        text.replace(handlebarsRegex, (match, _, offset) => {
          if (offset > lastIndex) {
            fragment.appendChild(
              document.createTextNode(text.substring(lastIndex, offset))
            );
          }

          const trimmedMatch = match.trim();
          if (trimmedMatch.startsWith('{{') && trimmedMatch.endsWith('}}')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'om-handlebars-block';
            wrapper.textContent = trimmedMatch;
            fragment.appendChild(wrapper);
          } else {
            fragment.appendChild(document.createTextNode(match));
          }

          lastIndex = offset + match.length;

          return match;
        });

        if (lastIndex < text.length) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex))
          );
        }

        node.parentNode?.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.tagName === 'BR') {
        return;
      }

      Array.from(node.childNodes).forEach(processNode);
    }
  };

  processNode(tempDiv);

  return tempDiv.innerHTML;
};

// Function to generate the placeholders (variables) for Handlebars
export const fetchHandlebarsVariables = async (): Promise<HandlebarsItem[]> => {
  // Mock variables for now
  return [
    {
      id: 'userName',
      name: 'userName',
      label: 'userName',
      type: 'variable',
      description: 'Current user name',
    },
    {
      id: 'userEmail',
      name: 'userEmail',
      label: 'userEmail',
      type: 'variable',
      description: 'Current user email',
    },
    {
      id: 'currentDate',
      name: 'currentDate',
      label: 'currentDate',
      type: 'variable',
      description: 'Current date',
    },
  ];
};

export const handlebarsSuggestion = () => ({
  items: async ({ query }: { query: string }) => {
    // Fetch variables if not cached
    const PLACEHOLDERS = await fetchHandlebarsVariables();

    // Combine helpers and variables
    const allItems = [...DEFAULT_HELPERS, ...PLACEHOLDERS];

    // Filter based on query
    if (!query) {
      return allItems;
    }

    return allItems.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  },

  render: () => {
    let component: ReactRenderer;
    let popup: Instance<Props>[] = [];
    let hasPopup = !isEmpty(popup);

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(HandlebarsList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect:
            props.clientRect as Props['getReferenceClientRect'],
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
        hasPopup = !isEmpty(popup);
      },

      onUpdate(props: SuggestionProps) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        if (hasPopup) {
          popup[0].setProps({
            getReferenceClientRect:
              props.clientRect as Props['getReferenceClientRect'],
          });
        }
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (
          props.event.key === 'Escape' &&
          hasPopup &&
          !popup[0].state.isDestroyed
        ) {
          popup[0].hide();

          return true;
        }

        return (component?.ref as ExtensionRef)?.onKeyDown(props);
      },

      onExit() {
        if (hasPopup && !popup[0].state.isDestroyed) {
          popup[0].destroy();
        }
      },
    };
  },
});
