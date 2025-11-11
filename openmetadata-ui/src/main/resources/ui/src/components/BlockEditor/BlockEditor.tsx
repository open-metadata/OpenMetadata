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
import { EditorContent } from '@tiptap/react';
import classNames from 'classnames';
import { isNil, isUndefined } from 'lodash';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EDITOR_OPTIONS,
  TEXT_TYPES,
} from '../../constants/BlockEditor.constants';
import { formatContent, setEditorContent } from '../../utils/BlockEditorUtils';
import Banner from '../common/Banner/Banner';
import { useEntityAttachment } from '../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import BarMenu from './BarMenu/BarMenu';
import './block-editor.less';
import {
  BlockEditorProps,
  BlockEditorRef,
  EditorSlotsRef,
  FileType,
} from './BlockEditor.interface';
import EditorSlots from './EditorSlots';
import { extensions } from './Extensions';
import './Extensions/File/file-node.less';
import { useCustomEditor } from './hooks/useCustomEditor';

const BlockEditor = forwardRef<BlockEditorRef, BlockEditorProps>(
  (
    {
      content = '',
      editable = true,
      menuType = 'bubble',
      autoFocus,
      placeholder,
      onChange,
      showInlineAlert = true,
    },
    ref
  ) => {
    const { i18n } = useTranslation();
    const editorSlots = useRef<EditorSlotsRef>(null);
    const {
      allowFileUpload,
      allowImageUpload,
      handleFileUpload,
      errorMessage,
      handleErrorMessage,
    } = useEntityAttachment();

    const editorWrapperRef = useRef<HTMLDivElement>(null);

    const editor = useCustomEditor({
      ...EDITOR_OPTIONS,
      extensions,
      onUpdate({ editor }) {
        handleErrorMessage?.(undefined);
        const htmlContent = editor.getHTML();
        const backendFormat = formatContent(htmlContent, 'server');
        onChange?.(backendFormat);
      },
      editorProps: {
        attributes: {
          class: 'om-block-editor',
          ...(autoFocus ? { autofocus: 'true' } : {}),
        },
        handleDOMEvents: {
          paste: (view, event) => {
            const items = Array.from(event.clipboardData?.items || []);
            // Check if the paste contains text types
            const hasText = items.some(
              (item) => item.kind === 'string' && TEXT_TYPES.includes(item.type)
            );
            // Allow paste if either image or file upload is enabled or if the paste contains text types
            if ((!allowImageUpload && !allowFileUpload) || hasText) {
              return false;
            }

            const files = items
              .filter((item) => item.kind === FileType.FILE)
              .map((item) => item.getAsFile())
              .filter(Boolean) as File[];

            if (!files.length) {
              return false;
            }

            event.preventDefault();
            const pos = view.state.selection.from;
            handleFileUpload?.(files[0], view, pos, showInlineAlert);

            return true;
          },
        },
      },
      autofocus: autoFocus,
    });

    // this hook to expose the editor instance
    useImperativeHandle(ref, () => ({
      editor,
    }));

    // Handle drag and drop events
    const handleDragEnter = (e: React.DragEvent) => {
      if (!allowImageUpload && !allowFileUpload) {
        return;
      }

      handleErrorMessage?.(undefined);
      const { items } = e.dataTransfer;
      const hasFiles = Array.from(items).some(
        (item) => item.kind === FileType.FILE
      );

      if (hasFiles) {
        const editorElement = document.querySelector(
          '.ProseMirror[contenteditable="true"]'
        );
        if (editorElement) {
          (editorElement as HTMLElement).classList.add('drag-over');
        }
      }
    };

    const handleDragLeave = (e: React.DragEvent) => {
      const editorElement = document.querySelector(
        '.ProseMirror[contenteditable="true"]'
      );
      // Only remove class if we're leaving the editor area
      if (editorElement && !editorElement.contains(e.relatedTarget as Node)) {
        (editorElement as HTMLElement).classList.remove('drag-over');
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      if ((!allowImageUpload && !allowFileUpload) || !editor?.view) {
        return;
      }

      e.preventDefault();

      const editorElement = document.querySelector(
        '.ProseMirror[contenteditable="true"]'
      );
      if (editorElement) {
        (editorElement as HTMLElement).classList.remove('drag-over');
      }

      const { files, items } = e.dataTransfer;

      // Only handle file drops, let BlockAndDragDrop handle block moves
      if (!files?.length || items[0]?.type === FileType.TEXT_HTML) {
        return;
      }

      const coordinates = editor.view.posAtCoords({
        left: e.clientX,
        top: e.clientY,
      });

      if (coordinates) {
        handleFileUpload?.(
          files[0],
          editor.view,
          coordinates.pos,
          showInlineAlert
        );
      }
    };

    // this effect to handle the content change
    useEffect(() => {
      if (isNil(editor) || editor.isDestroyed || content === undefined) {
        return;
      }

      // We use setTimeout to avoid any flushSync console errors as
      // mentioned here https://github.com/ueberdosis/tiptap/issues/3764#issuecomment-1546854730
      setTimeout(() => {
        if (content !== undefined) {
          const htmlContent = formatContent(content, 'client');
          setEditorContent(editor, htmlContent);
        }
      });
    }, [content, editor]);

    // this effect to handle the editable state
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

    // this effect to handle the RTL and LTR direction
    useEffect(() => {
      const editorWrapper = editorWrapperRef.current;
      if (!editorWrapper) {
        return;
      }
      editorWrapper.setAttribute('dir', i18n.dir());
      editorWrapper.style.textAlign = i18n.dir() === 'rtl' ? 'right' : 'left';
    }, [i18n]);

    return (
      <div
        className={classNames('block-editor-wrapper', {
          'block-editor-wrapper--bar-menu': menuType === 'bar',
          'block-editor-wrapper--bubble-menu': menuType === 'bubble',
        })}
        id="block-editor-wrapper"
        ref={editorWrapperRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}>
        {showInlineAlert && errorMessage && (
          <Banner
            className="border-radius"
            isLoading={isUndefined(errorMessage)}
            message={errorMessage}
            type="error"
          />
        )}
        {menuType === 'bar' && !isNil(editor) && (
          <BarMenu
            editor={editor}
            onLinkToggle={editorSlots.current?.onLinkToggle}
          />
        )}
        <EditorContent
          editor={editor}
          placeholder={placeholder}
          onMouseDown={editorSlots.current?.onMouseDown}
        />
        <EditorSlots editor={editor} menuType={menuType} ref={editorSlots} />
      </div>
    );
  }
);

export default BlockEditor;
