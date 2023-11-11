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
import { EditorOptions } from '@tiptap/core';

export const EDITOR_OPTIONS: Partial<EditorOptions> = {
  enableInputRules: [
    'blockquote',
    'bold',
    'bulletList',
    'code',
    'codeBlock',
    'horizontalRule',
    'italic',
    'listItem',
    'orderedList',
    'strike',
    'image',
    'taskItem',
  ],
  parseOptions: {
    preserveWhitespace: 'full',
  },
};

export const IMAGE_INPUT_REGEX =
  /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/;

export const CLICKABLE_NODES = [
  'IMG',
  'P',
  'A',
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'svg',
  'IFRAME',
];

export const DROP_CURSOR_COLOR = '#ebf6fe';
