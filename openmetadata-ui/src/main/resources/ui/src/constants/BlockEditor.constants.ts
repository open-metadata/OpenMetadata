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
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import DiffView from '../components/BlockEditor/Extensions/diffView';
import { Hashtag } from '../components/BlockEditor/Extensions/hashtag';
import { hashtagSuggestion } from '../components/BlockEditor/Extensions/hashtag/hashtagSuggestion';
import { Image } from '../components/BlockEditor/Extensions/image';
import { Mention } from '../components/BlockEditor/Extensions/mention';
import { mentionSuggestion } from '../components/BlockEditor/Extensions/mention/mentionSuggestions';
import slashCommand from '../components/BlockEditor/Extensions/slashCommand';
import { getSuggestionItems } from '../components/BlockEditor/Extensions/slashCommand/items';
import renderItems from '../components/BlockEditor/Extensions/slashCommand/renderItems';

export const EDITOR_OPTIONS: Partial<EditorOptions> = {
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    Placeholder.configure({
      showOnlyWhenEditable: true,
      includeChildren: true,
      showOnlyCurrent: false,
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-node-empty',
      placeholder: ({ editor: coreEditor }) => {
        if (coreEditor.isDestroyed) {
          return '';
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
  ],

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
  ],
  parseOptions: {
    preserveWhitespace: 'full',
  },
};

export const IMAGE_INPUT_REGEX =
  /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/;
