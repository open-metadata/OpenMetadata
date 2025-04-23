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
import MathEquationImage from '../../../../assets/img/ic-format-math-equation.png';
import BulletListImage from '../../../../assets/img/ic-slash-bullet-list.png';
import DividerImage from '../../../../assets/img/ic-slash-divider.png';
import H1Image from '../../../../assets/img/ic-slash-h1.png';
import H2Image from '../../../../assets/img/ic-slash-h2.png';
import H3Image from '../../../../assets/img/ic-slash-h3.png';
import NumberedListImage from '../../../../assets/img/ic-slash-numbered-list.png';
import QuoteImage from '../../../../assets/img/ic-slash-quote.png';
import TextImage from '../../../../assets/img/ic-slash-text.png';
import TaskListIcon from '../../../../assets/img/ic-task-list.png';
import IconFormatAttachment from '../../../../assets/svg/ic-format-attachment.svg';
import IconFormatAudio from '../../../../assets/svg/ic-format-audio.svg';
import IconFormatCallout from '../../../../assets/svg/ic-format-callout.svg';
import CodeBlockImage from '../../../../assets/svg/ic-format-code-block.svg';
import IconFormatImage from '../../../../assets/svg/ic-format-image.svg';
import IconTable from '../../../../assets/svg/ic-format-table.svg';
import IconFormatVideo from '../../../../assets/svg/ic-format-video.svg';
import MentionImage from '../../../../assets/svg/ic-mentions.svg';
import { FileType } from '../../BlockEditor.interface';

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
  isFileCommand?: boolean;
  isSvg?: boolean;
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
      isSvg: true,
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
      isSvg: true,
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
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setFile({
            url: '',
            fileName: '',
            fileSize: null,
            mimeType: FileType.IMAGE,
            type: FileType.IMAGE,
            isImage: true,
          })
          .run();
      },
      imgSrc: IconFormatImage,
      searchTerms: ['image', 'media'],
    },
    {
      title: 'Video',
      description: 'Add a video',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setFile({
            url: '',
            fileName: '',
            fileSize: null,
            mimeType: FileType.VIDEO,
            type: FileType.VIDEO,
          })
          .run();
      },
      imgSrc: IconFormatVideo,
      searchTerms: ['video', 'media', 'player'],
      isFileCommand: true,
      isSvg: true,
    },
    {
      title: 'Audio',
      description: 'Add audio',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setFile({
            url: '',
            fileName: '',
            fileSize: null,
            mimeType: FileType.AUDIO,
            type: FileType.AUDIO,
          })
          .run();
      },
      imgSrc: IconFormatAudio,
      searchTerms: ['audio', 'sound', 'music'],
      isFileCommand: true,
      isSvg: true,
    },
    {
      title: 'File',
      description: 'Add a file attachment',
      type: SuggestionItemType.ADVANCED_BLOCKS,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setFile({
            url: '',
            fileName: '',
            fileSize: null,
            mimeType: '',
            type: FileType.FILE,
          })
          .run();
      },
      imgSrc: IconFormatAttachment,
      searchTerms: ['file', 'attachment', 'document'],
      isFileCommand: true,
      isSvg: true,
    },
    {
      title: 'Task List',
      description: 'A list of tasks to do',
      searchTerms: ['task', 'checklist'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
      imgSrc: TaskListIcon,
      type: SuggestionItemType.ADVANCED_BLOCKS,
    },
    {
      title: 'Callout',
      description: 'A simple callout block',
      searchTerms: ['callout', 'info', 'warning', 'danger', 'note'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCallout({}).run();
      },
      type: SuggestionItemType.ADVANCED_BLOCKS,
      imgSrc: IconFormatCallout,
      isSvg: true,
    },
    {
      title: 'Table',
      description: 'Add tabular content',
      searchTerms: ['table', 'row', 'column', 'tabular'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
      type: SuggestionItemType.ADVANCED_BLOCKS,
      imgSrc: IconTable,
      isSvg: true,
    },
    {
      title: 'Math Equation',
      description: 'Add a math equation',
      searchTerms: ['math', 'equation', 'latex', 'katex'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: 'MathEquation',
            attrs: {
              isEditing: true,
              math_equation: '',
            },
          })
          .run();
      },
      type: SuggestionItemType.ADVANCED_BLOCKS,
      imgSrc: MathEquationImage,
      isSvg: true,
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
