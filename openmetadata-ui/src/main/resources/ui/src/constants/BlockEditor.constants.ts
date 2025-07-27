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
import { ReactComponent as IconDanger } from '../assets/svg/callout-danger.svg';
import { ReactComponent as IconInfo } from '../assets/svg/callout-info.svg';
import { ReactComponent as IconNote } from '../assets/svg/callout-note.svg';
import { ReactComponent as IconWarning } from '../assets/svg/callout-warning.svg';

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
    'callout',
    'link',
    'MathEquation',
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

export const CALLOUT_CONTENT = {
  note: IconNote,
  warning: IconWarning,
  info: IconInfo,
  danger: IconDanger,
};

export const CALL_OUT_REGEX = /^:::([A-Za-z]*)?$/;
export const CALL_OUT_INPUT_RULE_REGEX = /^::: $/;

export const LINK_INPUT_REGEX =
  /(?:^|\s)\[([^\]]*)?\]\((\S+)(?: ["“](.+)["”])?\)$/i;

export const LINK_PASTE_REGEX =
  /(?:^|\s)\[([^\]]*)?\]\((\S+)(?: ["“](.+)["”])?\)/gi;

export const UPLOADED_ASSETS_URL = '/api/v1/attachments/';

export const TEXT_TYPES = ['text/plain', 'text/rtf'];
