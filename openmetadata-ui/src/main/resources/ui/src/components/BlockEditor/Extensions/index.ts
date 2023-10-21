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

import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import BlockAndDragDrop from './BlockAndDragDrop/BlockAndDragDrop';
import DiffView from './diff-view';
import { Focus } from './focus';
import { Hashtag } from './hashtag';
import { hashtagSuggestion } from './hashtag/hashtagSuggestion';
import { Image } from './image/image';
import { LinkExtension } from './link';
import { Mention } from './mention';
import { mentionSuggestion } from './mention/mentionSuggestions';
import slashCommand from './slash-command';
import { getSuggestionItems } from './slash-command/items';
import renderItems from './slash-command/renderItems';

export const extensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
    bulletList: {
      HTMLAttributes: {
        class: 'om-list-disc',
      },
    },
    orderedList: {
      HTMLAttributes: {
        class: 'om-list-decimal',
      },
    },
    listItem: {
      HTMLAttributes: {
        class: 'om-leading-normal',
      },
    },
  }),
  Placeholder.configure({
    showOnlyWhenEditable: true,
    includeChildren: true,
    showOnlyCurrent: false,
    emptyEditorClass: 'is-editor-empty',
    emptyNodeClass: 'is-node-empty',
    placeholder: ({ editor: coreEditor, node }) => {
      if (coreEditor.isDestroyed) {
        return '';
      }
      if (node.type.name === 'heading') {
        return `Heading ${node.attrs.level}`;
      }

      return 'Type "/" for commands...';
    },
  }),
  LinkExtension.configure({
    autolink: false,
    openOnClick: false,
    linkOnPaste: true,
    HTMLAttributes: {
      rel: 'noopener noreferrer nofollow',
      target: '_blank',
    },
    validate: (href) => /^https?:\/\//.test(href),
  }),
  slashCommand.configure({
    slashSuggestion: {
      items: getSuggestionItems,
      render: renderItems,
    },
  }),
  TaskList.configure({
    HTMLAttributes: {
      class: 'om-task-list',
    },
  }),
  TaskItem.configure({
    HTMLAttributes: {
      class: 'om-task-item',
    },
  }),
  Mention.configure({
    suggestion: mentionSuggestion(),
  }),
  Hashtag.configure({
    suggestion: hashtagSuggestion(),
  }),
  DiffView,
  Image.configure({
    allowBase64: true,
    inline: true,
  }),
  BlockAndDragDrop,
  Focus.configure({
    mode: 'deepest',
  }),
];
