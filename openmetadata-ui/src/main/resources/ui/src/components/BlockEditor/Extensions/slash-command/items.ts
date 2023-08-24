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
import { Editor, Range } from '@tiptap/core';

export enum SuggestionItemType {
  BASIC_BLOCKS = 'Basic blocks',
}

export interface SuggestionItem {
  title: string;
  description: string;
  type: SuggestionItemType;
  shortcut: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: (props: { editor: Editor; range: Range; props: any }) => void;
}

export const getSuggestionItems = (props: { query: string; editor: Editor }) =>
  (
    [
      {
        title: 'Text',
        description: 'Plain text',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('paragraph').run();
        },
      },
      {
        title: 'H1',
        description: 'Heading 1',
        shortcut: '#',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 1 })
            .run();
        },
      },
      {
        title: 'H2',
        description: 'Heading 2',
        shortcut: '##',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 2 })
            .run();
        },
      },
      {
        title: 'H3',
        description: 'Heading 3',
        shortcut: '###',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 3 })
            .run();
        },
      },
      {
        title: 'Code Block',
        description: 'Add a code block',
        shortcut: '```',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: 'Bullet List',
        description: 'Create a simple bulleted list',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: 'Numbered List',
        description: 'Create a list with numbering',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: 'Quote',
        description: 'Capture a quote',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: 'Divider',
        description: 'Visually divide blocks',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
    ] as SuggestionItem[]
  )
    .filter((item) =>
      item.title.toLowerCase().startsWith(props.query.toLowerCase())
    )
    .slice(0, 12);
