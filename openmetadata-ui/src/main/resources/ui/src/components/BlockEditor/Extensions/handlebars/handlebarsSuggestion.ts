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
import { ReactRenderer } from '@tiptap/react';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { isEmpty } from 'lodash';
import tippy, { Instance, Props } from 'tippy.js';
import { ExtensionRef } from '../../BlockEditor.interface';
import HandlebarsList, { HandlebarsItem } from './HandlebarsList';

// Default handlebars helpers
const DEFAULT_HELPERS: HandlebarsItem[] = [
  {
    id: 'if',
    name: 'if',
    label: 'if',
    type: 'helper',
    description: 'Conditional block helper',
    syntax: '{{#if }}\n\n{{else}}\n\n{{/if}}',
    cursorOffset: 6, // Position after "{{#if "
  },
  {
    id: 'each',
    name: 'each',
    label: 'each',
    type: 'helper',
    description: 'Iterate over a list',
    syntax: '{{#each }}\n\n{{/each}}',
    cursorOffset: 8, // Position after "{{#each "
  },
  {
    id: 'with',
    name: 'with',
    label: 'with',
    type: 'helper',
    description: 'Change the context',
    syntax: '{{#with }}\n\n{{/with}}',
    cursorOffset: 8, // Position after "{{#with "
  },
  {
    id: 'unless',
    name: 'unless',
    label: 'unless',
    type: 'helper',
    description: 'Inverse conditional',
    syntax: '{{#unless }}\n\n{{else}}\n\n{{/unless}}',
    cursorOffset: 10, // Position after "{{#unless "
  },
  {
    id: 'eq',
    name: 'eq',
    label: 'eq',
    type: 'helper',
    description: 'Equality comparison',
    syntax: '{{#if (eq  )}}{{/if}}',
    cursorOffset: 10, // Position after "{{#if (eq "
  },
  {
    id: 'ne',
    name: 'ne',
    label: 'ne',
    type: 'helper',
    description: 'Not equal comparison',
    syntax: '{{#if (ne  )}}{{/if}}',
    cursorOffset: 10, // Position after "{{#if (ne "
  },
  {
    id: 'gt',
    name: 'gt',
    label: 'gt',
    type: 'helper',
    description: 'Greater than comparison',
    syntax: '{{#if (gt  )}}{{/if}}',
    cursorOffset: 10, // Position after "{{#if (gt "
  },
  {
    id: 'lt',
    name: 'lt',
    label: 'lt',
    type: 'helper',
    description: 'Less than comparison',
    syntax: '{{#if (lt  )}}{{/if}}',
    cursorOffset: 10, // Position after "{{#if (lt "
  },
  {
    id: 'and',
    name: 'and',
    label: 'and',
    type: 'helper',
    description: 'Logical AND',
    syntax: '{{#if (and  )}}{{/if}}',
    cursorOffset: 11, // Position after "{{#if (and "
  },
  {
    id: 'or',
    name: 'or',
    label: 'or',
    type: 'helper',
    description: 'Logical OR',
    syntax: '{{#if (or  )}}{{/if}}',
    cursorOffset: 10, // Position after "{{#if (or "
  },
];

// This will be populated by API call in the future
let cachedVariables: HandlebarsItem[] = [];

// Function to fetch variables from API (placeholder for future implementation)
export const fetchHandlebarsVariables = async (): Promise<HandlebarsItem[]> => {
  // TODO: Replace with actual API call
  // const response = await getHandlebarsVariables();
  // return response.data.map(variable => ({
  //   id: variable.id,
  //   name: variable.name,
  //   label: variable.name,
  //   type: 'variable',
  //   description: variable.description,
  // }));

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

// Function to set variables (can be called from outside)
export const setHandlebarsVariables = (variables: HandlebarsItem[]) => {
  cachedVariables = variables;
};

export const handlebarsSuggestion = () => ({
  items: async ({ query }: { query: string }) => {
    // Fetch variables if not cached
    if (isEmpty(cachedVariables)) {
      cachedVariables = await fetchHandlebarsVariables();
    }

    // Combine helpers and variables
    const allItems = [...DEFAULT_HELPERS, ...cachedVariables];

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
