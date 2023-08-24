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
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { isNil } from 'lodash';
import React, { useState } from 'react';
import './block-editor.less';
import LinkModal, { LinkData } from './Components/LinkModal';
import SlashCommand from './Extensions/slash-command';
import { getSuggestionItems } from './Extensions/slash-command/items';
import renderItems from './Extensions/slash-command/renderItems';
import BubbleMenu from './Menu/BubbleMenu';

const BlockEditor = () => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);

  const editor = useEditor({
    autofocus: true,
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
        placeholder: ({ node, editor: coreEditor }) => {
          if (coreEditor.isDestroyed) {
            return '';
          }

          const headingPlaceholders: {
            [key: number]: string;
          } = {
            1: 'Heading 1',
            2: 'Heading 2',
            3: 'Heading 3',
          };

          if (node.type.name === 'heading') {
            const level = node.attrs.level as number;

            return headingPlaceholders[level];
          }

          if (
            node.type.name === 'paragraph' &&
            coreEditor.getJSON().content?.length === 1
          ) {
            return 'Type / to get started';
          }

          if (node.type.name === 'paragraph') {
            const selectedNode = coreEditor.view.domAtPos(
              coreEditor.state.selection.from
            ).node;
            if (
              selectedNode.nodeName === 'P' &&
              selectedNode.firstChild?.parentElement?.id === node.attrs.id
            ) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parentNode = (coreEditor.state.selection.$from as any)
                .path[3];
              if (
                parentNode?.type?.name === 'blockquote' &&
                parentNode?.content?.content?.[
                  parentNode?.content?.content?.length - 1
                ]?.attrs?.id === node.attrs?.id
              ) {
                return 'Type or hit enter to exit quote';
              }

              return 'Type / for commands';
            }
          }

          return '';
        },
      }),
      SlashCommand.configure({
        suggestion: {
          items: getSuggestionItems,
          render: renderItems,
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
    ],
  });

  const handleLinkToggle = () => {
    setIsLinkModalOpen((prev) => !prev);
  };

  const handleLinkCancel = () => {
    handleLinkToggle();
    if (!isNil(editor)) {
      editor?.chain().blur().run();
    }
  };

  const handleLinkSave = (values: LinkData) => {
    if (isNil(editor)) {
      return;
    }
    // set the link
    editor?.chain().focus().setLink({ href: values.href }).run();

    // move cursor at the end
    editor?.chain().selectTextblockEnd().run();

    // close the modal
    handleLinkToggle();
  };

  const menus = !isNil(editor) && (
    <BubbleMenu editor={editor} toggleLink={handleLinkToggle} />
  );

  return (
    <>
      {isLinkModalOpen && (
        <LinkModal
          data={{ href: editor?.getAttributes('link').href }}
          isOpen={isLinkModalOpen}
          onCancel={handleLinkCancel}
          onSave={handleLinkSave}
        />
      )}
      <div className="block-editor-wrapper">
        <EditorContent editor={editor} />
        {menus}
      </div>
    </>
  );
};

export default BlockEditor;
