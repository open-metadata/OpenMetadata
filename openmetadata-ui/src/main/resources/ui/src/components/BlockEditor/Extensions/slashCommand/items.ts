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
import BulletListImage from '../../../../assets/img/ic-slash-bullet-list.png';
import DividerImage from '../../../../assets/img/ic-slash-divider.png';
import H1Image from '../../../../assets/img/ic-slash-h1.png';
import H2Image from '../../../../assets/img/ic-slash-h2.png';
import H3Image from '../../../../assets/img/ic-slash-h3.png';
import NumberedListImage from '../../../../assets/img/ic-slash-numbered-list.png';
import QuoteImage from '../../../../assets/img/ic-slash-quote.png';
import TextImage from '../../../../assets/img/ic-slash-text.png';
import TaskListImage from '../../../../assets/img/ic-task-list.png';
import CodeBlockImage from '../../../../assets/svg/ic-format-code-block.svg';

export enum SuggestionItemType {
  BASIC_BLOCKS = 'Basic blocks',
}

export interface SuggestionItem {
  title: string;
  description: string;
  type: SuggestionItemType;
  shortcut: string | null;
  imgSrc: string;
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
        imgSrc: TextImage,
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
        imgSrc: H1Image,
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
        imgSrc: H2Image,
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
        imgSrc: H3Image,
      },
      {
        title: 'Code Block',
        description: 'Add a code block',
        shortcut: '```',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
        imgSrc: CodeBlockImage,
      },
      {
        title: 'Bullet List',
        description: 'Create a simple bulleted list',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
        imgSrc: BulletListImage,
      },
      {
        title: 'Numbered List',
        description: 'Create a list with numbering',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
        imgSrc: NumberedListImage,
      },
      {
        title: 'Task List',
        description: 'Create a task list',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
        imgSrc: TaskListImage,
      },
      {
        title: 'Quote',
        description: 'Capture a quote',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
        imgSrc: QuoteImage,
      },
      {
        title: 'Divider',
        description: 'Visually divide blocks',
        shortcut: null,
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor }) => {
          editor.chain().focus().setHorizontalRule().run();
        },
        imgSrc: DividerImage,
      },
    ] as SuggestionItem[]
  ).filter((item) =>
    item.title.toLowerCase().startsWith(props.query.toLowerCase())
  );
