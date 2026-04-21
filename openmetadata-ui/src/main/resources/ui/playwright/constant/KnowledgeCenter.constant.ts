/*
 *  Copyright 2026 Collate.
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
export const SHORTCUTS = {
  bold: 'Meta+b',
  italic: 'Meta+i',
  code: 'Meta+e',
  undo: 'Meta+z',
  redo: 'Meta+Shift+z',
  selectAll: 'Meta+a',
  copy: 'Meta+c',
  paste: 'Meta+v',
  selectWord: 'Meta+Shift+ArrowLeft',
  enter: 'Enter',
  end: 'End',
  backspace: 'Backspace',
  tab: 'Tab',
} as const;

export const SLASH_COMMANDS = {
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  bullet: 'Bullet',
  numbered: 'Numbered',
  divider: 'Divider',
  quote: 'Quote',
  codeBlock: 'CodeBlock',
  callout: 'Callout',
  table: 'Table',
  task: 'Task',
} as const;
