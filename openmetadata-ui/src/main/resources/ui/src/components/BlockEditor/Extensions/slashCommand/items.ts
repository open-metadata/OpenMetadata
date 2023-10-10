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
import HashtagImage from '../../../../assets/img/ic-format-hashtag.png';
import BulletListImage from '../../../../assets/img/ic-slash-bullet-list.png';
import DividerImage from '../../../../assets/img/ic-slash-divider.png';
import H1Image from '../../../../assets/img/ic-slash-h1.png';
import H2Image from '../../../../assets/img/ic-slash-h2.png';
import H3Image from '../../../../assets/img/ic-slash-h3.png';
import NumberedListImage from '../../../../assets/img/ic-slash-numbered-list.png';
import QuoteImage from '../../../../assets/img/ic-slash-quote.png';
import TextImage from '../../../../assets/img/ic-slash-text.png';
import CodeBlockImage from '../../../../assets/svg/ic-format-code-block.svg';
import MentionImage from '../../../../assets/svg/ic-mentions.svg';

export enum SuggestionItemType {
  BASIC_BLOCKS = 'Basic',
  ADVANCED_BLOCKS = 'Advanced',
}

export interface SuggestionItem {
  title: string;
  description: string;
  type: SuggestionItemType;
  imgSrc: string;
  command: (props: { editor: Editor; range: Range }) => void;
}

export const getSuggestionItems = (props: { query: string; editor: Editor }) =>
  (
    [
      {
        title: 'Text',
        description: 'Start writing with plain text',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('paragraph').run();
        },
        imgSrc: TextImage,
      },
      {
        title: 'H1',
        description: 'Big heading',
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
        description: 'Medium heading',
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
        description: 'Small heading',
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
        title: 'Bullet List',
        description: 'Create a simple bullet list',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
        imgSrc: BulletListImage,
      },
      {
        title: 'Numbered List',
        description: 'Create a simple numbered list',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
        imgSrc: NumberedListImage,
      },
      {
        title: 'Divider',
        description: 'Insert a dividing line',
        type: SuggestionItemType.BASIC_BLOCKS,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setHardBreak()
            .setHorizontalRule()
            .run();
        },
        imgSrc: DividerImage,
      },
      // advanced blocks
      {
        title: 'Code Block',
        description: 'Add a block of code',
        type: SuggestionItemType.ADVANCED_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
        imgSrc: CodeBlockImage,
      },

      {
        title: 'Quote',
        description: 'Add a quote',
        type: SuggestionItemType.ADVANCED_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
        imgSrc: QuoteImage,
      },
      {
        title: 'Mention',
        description: 'Add a user or team',
        type: SuggestionItemType.ADVANCED_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).insertContent('@').run();
        },
        imgSrc: MentionImage,
      },
      {
        title: 'Link data asset',
        description: 'Add a data asset',
        type: SuggestionItemType.ADVANCED_BLOCKS,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).insertContent('#').run();
        },
        imgSrc: HashtagImage,
      },
    ] as SuggestionItem[]
  ).filter((item) =>
    item.title.toLowerCase().startsWith(props.query.toLowerCase())
  );
