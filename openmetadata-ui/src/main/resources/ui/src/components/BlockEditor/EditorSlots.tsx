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
import { Editor, ReactRenderer } from '@tiptap/react';
import { isEmpty, isNil } from 'lodash';
import { forwardRef, useImperativeHandle, useState } from 'react';
import tippy, { Instance, Props } from 'tippy.js';
import { EditorSlotsProps, EditorSlotsRef } from './BlockEditor.interface';
import BlockMenu from './BlockMenu/BlockMenu';
import BubbleMenu from './BubbleMenu/BubbleMenu';
import LinkModal, { LinkData } from './LinkModal/LinkModal';
import LinkPopup from './LinkPopup/LinkPopup';
import TableMenu from './TableMenu/TableMenu';

const EditorSlots = forwardRef<EditorSlotsRef, EditorSlotsProps>(
  ({ editor, menuType }, ref) => {
    const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);

    const handleLinkToggle = () => {
      setIsLinkModalOpen((prev) => !prev);
    };

    const handleLinkCancel = () => {
      handleLinkToggle();
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
      // if editor is not editable, do not show the link popup
      if (!editor?.isEditable) {
        return;
      }

      let popup: Instance<Props>[] = [];
      let component: ReactRenderer;
      const target = e.target as HTMLElement;
      const dataType = target.getAttribute('data-type');

      let hasPopup = !isEmpty(popup);

      if (['mention', 'hashtag'].includes(dataType ?? '')) {
        const href = target.getAttribute('href');
        const linkTarget = target.getAttribute('target');
        if (href && linkTarget) {
          window.open(href, linkTarget);
        }

        return;
      }

      const closestElement = target.closest('a');
      if (target.nodeName === 'A' || closestElement) {
        const href =
          target.getAttribute('href') || closestElement?.getAttribute('href');

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

    /**
     * render the bubble menu only if the editor is available
     * and the menu type is bubble
     */
    const menus = !isNil(editor) && menuType === 'bubble' && (
      <BubbleMenu editor={editor} toggleLink={handleLinkToggle} />
    );

    useImperativeHandle(ref, () => ({
      onMouseDown: handleLinkPopup,
      onLinkToggle: handleLinkToggle,
    }));

    if (isNil(editor)) {
      return null;
    }

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
        {menus}
        {!isNil(editor) && (
          <>
            <BlockMenu editor={editor} />
            <TableMenu editor={editor} />
          </>
        )}
      </>
    );
  }
);

export default EditorSlots;
