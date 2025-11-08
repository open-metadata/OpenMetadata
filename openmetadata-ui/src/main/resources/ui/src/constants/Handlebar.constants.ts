// Default handlebars helpers
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

import { HandlebarsItem } from '../components/BlockEditor/Extensions/handlebars/HandlebarsList';

export const DEFAULT_HELPERS: HandlebarsItem[] = [
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
