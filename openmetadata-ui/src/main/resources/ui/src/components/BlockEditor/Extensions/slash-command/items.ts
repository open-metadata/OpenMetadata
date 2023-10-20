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
import IconFormatImage from '../../../../assets/svg/ic-format-image.svg';
import MentionImage from '../../../../assets/svg/ic-mentions.svg';

export enum SuggestionItemType {
  BASIC_BLOCKS = 'Basic',
  ADVANCED_BLOCKS = 'Advanced',
}

interface CommandProps {
  editor: Editor;
  range: Range;
}

export interface SuggestionItem {
  title: string;
  description: string;
  type: SuggestionItemType;
  imgSrc: string;
  searchTerms: string[];
  command: (props: CommandProps) => void;
}

export const getSuggestionItems = (props: {
  query: string;
  editor: Editor;
}) => {
  const { query } = props;
  const suggestionItems: SuggestionItem[] = [
    {
      title: 'Text',
      description: 'Start writing with plain text',
      type: SuggestionItemType.BASIC_BLOCKS,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .run(),
      imgSrc: TextImage,
      searchTerms: ['p', 'paragraph'],
    },
    {
      title: 'H1',
      description: 'Big heading',
      type: SuggestionItemType.BASIC_BLOCKS,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 1 })
          .run(),
      imgSrc: H1Image,
      searchTerms: ['title', 'big', 'large'],
    },
    {
      title: 'H2',
      description: 'Medium heading',
      type: SuggestionItemType.BASIC_BLOCKS,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 2 })
          .run(),
      imgSrc: H2Image,
      searchTerms: ['subtitle', 'medium'],
    },
    {
      title: 'H3',
      description: 'Small heading',
      type: SuggestionItemType.BASIC_BLOCKS,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 3 })
          .run(),
      imgSrc: H3Image,
      searchTerms: ['subtitle', 'small'],
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bullet list',
      type: SuggestionItemType.BASIC_BLOCKS,
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
      imgSrc: BulletListImage,
      searchTerms: ['unordered', 'point'],
    },
    {
      title: 'Numbered List',
      description: 'Create a simple numbered list',
      type: SuggestionItemType.BASIC_BLOCKS,
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
      imgSrc: NumberedListImage,
      searchTerms: ['ordered'],
    },
    {
      title: 'Divider',
      description: 'Insert a dividing line',
      type: SuggestionItemType.BASIC_BLOCKS,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHardBreak()
          .setHorizontalRule()
          .run(),
      imgSrc: DividerImage,
      searchTerms: ['separator'],
    },
    // advanced blocks
    {
      title: 'Code Block',
      description: 'Add a block of code',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
      imgSrc: CodeBlockImage,
      searchTerms: ['codeblock'],
    },

    {
      title: 'Quote',
      description: 'Add a quote',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .toggleBlockquote()
          .run(),
      imgSrc: QuoteImage,
      searchTerms: ['blockquote'],
    },
    {
      title: 'Mention',
      description: 'Add a user or team',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent('@').run();
      },
      imgSrc: MentionImage,
      searchTerms: ['user', 'mention'],
    },
    {
      title: 'Link data asset',
      description: 'Add a data asset',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent('#').run();
      },
      imgSrc: HashtagImage,
      searchTerms: ['data asset', 'hashtag'],
    },
    {
      title: 'Image',
      description: 'Add an image',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setImage({ src: '' }).run();
      },
      imgSrc: IconFormatImage,
      searchTerms: ['image', 'media'],
    },
  ];

  const filteredItems = suggestionItems.filter((item) => {
    if (typeof query === 'string' && query.length > 0) {
      const search = query.toLowerCase();

      return (
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        (item.searchTerms &&
          item.searchTerms.some((term: string) => term.includes(search)))
      );
    }

    return true;
  });

  return filteredItems;
};
