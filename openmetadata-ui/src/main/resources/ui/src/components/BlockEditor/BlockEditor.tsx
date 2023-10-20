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
import { Editor, EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import { isEmpty, isNil } from 'lodash';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import tippy, { Instance, Props } from 'tippy.js';
import { EDITOR_OPTIONS } from '../../constants/BlockEditor.constants';
import {
  getBackendFormat,
  getFrontEndFormat,
  HTMLToMarkdown,
  MarkdownToHTMLConverter,
} from '../../utils/FeedUtils';
import './block-editor.less';
import BubbleMenu from './BubbleMenu/BubbleMenu';
import ImageModal, { ImageData } from './ImageModal/ImageModal';
import LinkModal, { LinkData } from './LinkModal/LinkModal';
import LinkPopup from './LinkPopup/LinkPopup';

export interface BlockEditorRef {
  onFocus: () => void;
}
export interface BlockEditorProps {
  // should be markdown string
  content?: string;
  editable?: boolean;
  // will be call with markdown content
  onChange?: (content: string) => void;
}

const BlockEditor = forwardRef<BlockEditorRef, BlockEditorProps>(
  ({ content = '', editable = true, onChange }, ref) => {
    const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

    const editor = useEditor({
      ...EDITOR_OPTIONS,
      onUpdate({ editor }) {
        const htmlContent = editor.getHTML();

        const markdown = HTMLToMarkdown.turndown(htmlContent);

        const backendFormat = getBackendFormat(markdown);

        onChange?.(backendFormat);
      },
    });

    const handleLinkToggle = () => {
      setIsLinkModalOpen((prev) => !prev);
    };
    const handleImageToggle = () => {
      setIsImageModalOpen((prev) => !prev);
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

    const handleLinkPopup = (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) => {
      let popup: Instance<Props>[] = [];
      let component: ReactRenderer;
      const target = e.target as HTMLElement;
      const dataType = target.getAttribute('data-type');

      let hasPopup = !isEmpty(popup);

      if (['mention', 'hashtag'].includes(dataType ?? '')) {
        return;
      }
      if (target.nodeName === 'A') {
        const href = target.getAttribute('href');

        component = new ReactRenderer(LinkPopup, {
          editor: editor as Editor,
          props: {
            href,
            handleLinkToggle: () => {
              handleLinkToggle();
              if (hasPopup) {
                popup[0].hide();
              }
            },
            handleUnlink: () => {
              handleUnlink();
              if (hasPopup) {
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
        hasPopup = !isEmpty(popup);
      } else {
        if (hasPopup) {
          popup[0].hide();
        }
      }
    };

    const handleAddImage = (values: ImageData) => {
      if (isNil(editor)) {
        return;
      }

      editor.chain().focus().setImage({ src: values.src }).run();

      handleImageToggle();
    };

    useImperativeHandle(ref, () => ({
      onFocus() {
        if (!isNil(editor) && !editor.isFocused) {
          editor.commands.focus('end');
        }
      },
    }));

    const menus = !isNil(editor) && (
      <BubbleMenu editor={editor} toggleLink={handleLinkToggle} />
    );

    useEffect(() => {
      if (isNil(editor) || editor.isDestroyed || content === undefined) {
        return;
      }

      // We use setTimeout to avoid any flushSync console errors as
      // mentioned here https://github.com/ueberdosis/tiptap/issues/3764#issuecomment-1546854730
      setTimeout(() => {
        if (content !== undefined) {
          const htmlContent = MarkdownToHTMLConverter.makeHtml(
            getFrontEndFormat(content)
          );
          editor.commands.setContent(htmlContent);
        }
      });
    }, [content, editor]);

    useEffect(() => {
      if (
        isNil(editor) ||
        editor.isDestroyed ||
        editor.isEditable === editable
      ) {
        return;
      }

      // We use setTimeout to avoid any flushSync console errors as
      // mentioned here https://github.com/ueberdosis/tiptap/issues/3764#issuecomment-1546854730
      setTimeout(() => editor.setEditable(editable));
    }, [editable, editor]);

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
        {isImageModalOpen && (
          <ImageModal
            isOpen={isImageModalOpen}
            onCancel={handleImageToggle}
            onSave={handleAddImage}
          />
        )}
        <div className="block-editor-wrapper">
          <EditorContent editor={editor} onMouseDown={handleLinkPopup} />
          {menus}
        </div>
      </>
    );
  }
);

export default BlockEditor;
