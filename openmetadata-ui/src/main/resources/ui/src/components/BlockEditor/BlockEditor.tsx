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
import { EditorView } from '@tiptap/pm/view';
import { EditorContent } from '@tiptap/react';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isNil, isString, isUndefined } from 'lodash';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EDITOR_OPTIONS } from '../../constants/BlockEditor.constants';
import { formatContent, setEditorContent } from '../../utils/BlockEditorUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Banner from '../common/Banner/Banner';
import { useEntityDescription } from '../common/EntityDescription/EntityDescriptionProvider/EntityDescriptionProvider';
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
      allowImageUpload,
      allowFileUpload,
      showInlineAlert = true,
      onImageUpload,
    },
    ref
  ) => {
    const { i18n, t } = useTranslation();
    const editorSlots = useRef<EditorSlotsRef>(null);
    const { entityType, entityFqn } = useEntityDescription();
    const [errorMessage, setErrorMessage] = useState<string>();
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    // Handle file upload logic
    const handleFileUpload = async (
      file: File,
      view: EditorView,
      pos: number
    ) => {
      if (!onImageUpload) {
        return;
      }

      const fileType = file.type;
      const isImage = fileType.startsWith(FileType.IMAGE);

      if (isImage && !allowImageUpload) {
        return;
      }

      if (!isImage && !allowFileUpload) {
        showInlineAlert
          ? setErrorMessage(t('message.only-image-files-supported'))
          : showErrorToast(t('message.only-image-files-supported'));

        return;
      }

      try {
        const url = await onImageUpload(file, entityType, entityFqn);

        if (isImage) {
          const imageNode = view.state.schema.nodes.image.create({
            src: url,
            alt: file.name,
          });
          const tr = view.state.tr.insert(pos, imageNode);
          view.dispatch(tr);
        } else {
          const { state } = view;
          const { tr } = state;

          const fileNode = state.schema.nodes.fileAttachment.create({
            url,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });

          tr.insert(pos, fileNode);
          view.dispatch(tr);
        }
      } catch (error) {
        showInlineAlert
          ? setErrorMessage(
              isString(error) ? error : t('label.failed-to-upload-file')
            )
          : showErrorToast(
              error as AxiosError,
              t('label.failed-to-upload-file')
            );
      }
    };

    const editor = useCustomEditor({
      ...EDITOR_OPTIONS,
      extensions,
      onUpdate({ editor }) {
        setErrorMessage(undefined);
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
            // Allow paste if either image or file upload is enabled
            if (!allowImageUpload && !allowFileUpload) {
              return false;
            }

            const items = Array.from(event.clipboardData?.items || []);
            const files = items
              .filter((item) => item.kind === FileType.FILE)
              .map((item) => item.getAsFile())
              .filter(Boolean) as File[];

            if (!files.length) {
              return false;
            }

            event.preventDefault();
            const pos = view.state.selection.from;
            handleFileUpload(files[0], view, pos);

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

      setErrorMessage(undefined);
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
        handleFileUpload(files[0], editor.view, coordinates.pos);
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
