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
import { message } from 'antd';
import classNames from 'classnames';
import { isNil } from 'lodash';
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
      onImageUpload,
    },
    ref
  ) => {
    const { i18n, t } = useTranslation();
    const editorSlots = useRef<EditorSlotsRef>(null);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const { entityType, entityFqn } = useEntityDescription();

    const handleFileUpload = async (
      file: File,
      view: EditorView,
      pos: number
    ) => {
      // Early return if no upload handler
      if (!onImageUpload) {
        return;
      }

      const fileType = file.type;
      const isImage = fileType.startsWith(FileType.IMAGE);

      // Check permissions based on file type
      if (isImage) {
        if (!allowImageUpload) {
          return;
        }
      } else if (!allowFileUpload) {
        message.error(t('message.only-image-files-supported'));

        return;
      }

      // Insert loading text
      const { tr } = view.state;
      const loadingNode = view.state.schema.text(
        t('label.uploading-file') + '...'
      );
      tr.insert(pos, loadingNode);
      view.dispatch(tr);

      try {
        // Upload the file
        const url = await onImageUpload(file, entityType, entityFqn);

        // Replace loading text with the file
        const newTr = view.state.tr;
        newTr.delete(pos, pos + loadingNode.nodeSize);

        if (isImage) {
          const imageNode = view.state.schema.nodes.image.create({
            src: url,
            alt: file.name,
          });
          newTr.insert(pos, imageNode);
        } else {
          const fileNode = view.state.schema.nodes.fileAttachment.create({
            url,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });
          newTr.insert(pos, fileNode);
        }

        view.dispatch(newTr);
      } catch (error) {
        // Clean up loading text on error
        const cleanupTr = view.state.tr;
        cleanupTr.delete(pos, pos + loadingNode.nodeSize);
        view.dispatch(cleanupTr);

        message.error(error ?? t('label.failed-to-upload-file'));
      }
    };

    const editor = useCustomEditor({
      ...EDITOR_OPTIONS,
      extensions,
      onUpdate({ editor }) {
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
          dragenter: (_view, event) => {
            // Allow drag if either image or file upload is enabled
            if (!allowImageUpload && !allowFileUpload) {
              return false;
            }

            const { items } = event.dataTransfer || {};
            const hasFiles = Array.from(items || []).some(
              (item) => item.kind === FileType.FILE
            );

            if (hasFiles) {
              setIsDraggingFile(true);
            }

            return false;
          },
          dragleave: () => {
            setIsDraggingFile(false);

            return false;
          },
          drop: (view, event) => {
            setIsDraggingFile(false);
            // Allow drop if either image or file upload is enabled
            if (!allowImageUpload && !allowFileUpload) {
              return false;
            }

            const { files, items } = event.dataTransfer || {};

            // Only handle file drops, let BlockAndDragDrop handle block moves
            if (!files?.length || items?.[0]?.type === FileType.TEXT_HTML) {
              return false;
            }

            event.preventDefault();

            // Remove drag-over class immediately
            const editorElement = document.querySelector(
              '.ProseMirror[contenteditable="true"]'
            );
            if (editorElement) {
              (editorElement as HTMLElement).classList.remove('drag-over');
            }

            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (!coordinates) {
              return false;
            }

            handleFileUpload(files[0], view, coordinates.pos);

            return true;
          },
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
      const editorWrapper = document.getElementById('block-editor-wrapper');
      if (!editorWrapper) {
        return;
      }
      editorWrapper.setAttribute('dir', i18n.dir());
      // text align right if rtl
      if (i18n.dir() === 'rtl') {
        editorWrapper.style.textAlign = 'right';
      } else {
        editorWrapper.style.textAlign = 'left';
      }
    }, [i18n]);

    // Add drag and drop visual feedback
    useEffect(() => {
      // Allow visual feedback if either image or file upload is enabled
      if ((!allowImageUpload && !allowFileUpload) || !isDraggingFile) {
        return;
      }

      // Target only editable ProseMirror instance
      const editorElement = document.querySelector(
        '.ProseMirror[contenteditable="true"]'
      );
      if (!editorElement) {
        return;
      }

      const handleDragOver = (e: Event) => {
        e.preventDefault();
        if (e instanceof DragEvent) {
          (editorElement as HTMLElement).classList.add('drag-over');
        }
      };

      const handleDragLeave = (e: Event) => {
        e.preventDefault();
        if (e instanceof DragEvent) {
          (editorElement as HTMLElement).classList.remove('drag-over');
          setIsDraggingFile(false);
        }
      };

      const handleDrop = (e: Event) => {
        if (e instanceof DragEvent) {
          (editorElement as HTMLElement).classList.remove('drag-over');
          setIsDraggingFile(false);
        }
      };

      editorElement.addEventListener('dragover', handleDragOver);
      editorElement.addEventListener('dragleave', handleDragLeave);
      editorElement.addEventListener('drop', handleDrop);

      return () => {
        editorElement.removeEventListener('dragover', handleDragOver);
        editorElement.removeEventListener('dragleave', handleDragLeave);
        editorElement.removeEventListener('drop', handleDrop);
      };
    }, [allowImageUpload, allowFileUpload, isDraggingFile]);

    return (
      <div
        className={classNames('block-editor-wrapper', {
          'block-editor-wrapper--bar-menu': menuType === 'bar',
          'block-editor-wrapper--bubble-menu': menuType === 'bubble',
        })}
        id="block-editor-wrapper">
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
