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
import { Editor, EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { isEmpty, isNil } from 'lodash';
import React, { useEffect, useState } from 'react';
import tippy, { Instance, Props } from 'tippy.js';
import './block-editor.less';
import LinkModal, { LinkData } from './Components/LinkModal';
import LinkPopup from './Components/LinkPopup';
import SlashCommand from './Extensions/slash-command';
import { getSuggestionItems } from './Extensions/slash-command/items';
import renderItems from './Extensions/slash-command/renderItems';
import BubbleMenu from './Menu/BubbleMenu';

const BlockEditor = () => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setHtmlState] = useState<string>('');

  const editor = useEditor({
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

          return 'Type / for commands';
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
      SlashCommand.configure({
        slashSuggestion: {
          items: getSuggestionItems,
          render: renderItems,
        },
      }),
    ],

    onUpdate({ editor }) {
      setHtmlState(editor.getHTML());
    },
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

  const handleLinkSave = (values: LinkData, op: 'edit' | 'add') => {
    if (isNil(editor)) {
      return;
    }
    // set the link
    if (op === 'edit') {
      editor
        ?.chain()
        .focus()
        .extendMarkRange('link')
        .updateAttributes('link', {
          href: values.href,
        })
        .run();
    }

    if (op === 'add') {
      editor?.chain().focus().setLink({ href: values.href }).run();
    }

    // move cursor at the end
    editor?.chain().selectTextblockEnd().run();

    // close the modal
    handleLinkToggle();
  };

  const handleUnlink = () => {
    if (isNil(editor)) {
      return;
    }

    editor?.chain().focus().extendMarkRange('link').unsetLink().run();

    // move cursor at the end
    editor?.chain().selectTextblockEnd().run();
  };

  const handleLinkPopup = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    let popup: Instance<Props>[] = [];
    let component: ReactRenderer;
    const target = e.target as HTMLElement;
    if (target.nodeName === 'A') {
      const href = target.getAttribute('href');

      component = new ReactRenderer(LinkPopup, {
        editor: editor as Editor,
        props: {
          href,
          handleLinkToggle: () => {
            handleLinkToggle();
            if (!isEmpty(popup)) {
              popup[0].hide();
            }
          },
          handleUnlink: () => {
            handleUnlink();
            if (!isEmpty(popup)) {
              popup[0].hide();
            }
          },
        },
      });

      popup = tippy('body', {
        getReferenceClientRect: () => target.getBoundingClientRect(),
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'top',
        hideOnClick: true,
      });
    } else {
      if (!isEmpty(popup)) {
        popup[0].hide();
      }
    }
  };

  const menus = !isNil(editor) && (
    <BubbleMenu editor={editor} toggleLink={handleLinkToggle} />
  );

  useEffect(() => {
    return () => {
      !editor?.isDestroyed && editor?.destroy();
    };
  }, [editor]);

  return (
    <>
      {isLinkModalOpen && (
        <LinkModal
          data={{ href: editor?.getAttributes('link').href }}
          isOpen={isLinkModalOpen}
          onCancel={handleLinkCancel}
          onSave={(values) =>
            handleLinkSave(
              values,
              editor?.getAttributes('link').href ? 'edit' : 'add'
            )
          }
        />
      )}
      <div className="block-editor-wrapper">
        <EditorContent editor={editor} onMouseDown={handleLinkPopup} />
        {menus}
      </div>
    </>
  );
};

export default BlockEditor;
