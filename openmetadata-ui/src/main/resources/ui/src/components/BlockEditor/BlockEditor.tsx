/*
 *  Copyright 2025 Collate.
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
import { isNil } from 'lodash';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EDITOR_OPTIONS } from '../../constants/BlockEditor.constants';
import { formatContent, setEditorContent } from '../../utils/BlockEditorUtils';
import BarMenu from './BarMenu/BarMenu';
import './block-editor.less';
import {
  BlockEditorProps,
  BlockEditorRef,
  EditorSlotsRef,
} from './BlockEditor.interface';
import EditorSlots from './EditorSlots';
import { extensions } from './Extensions';
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
    },
    ref
  ) => {
    const { i18n } = useTranslation();
    const editorSlots = useRef<EditorSlotsRef>(null);

    // Custom editor hook to initialize and update editor
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
      },
      autofocus: autoFocus,
    });

    // Expose the editor instance using useImperativeHandle
    useImperativeHandle(ref, () => ({
      editor,
    }));

    // Set content whenever it changes
    useEffect(() => {
      if (isNil(editor) || editor.isDestroyed || content === undefined) {
        return;
      }

      setTimeout(() => {
        if (content !== undefined) {
          const htmlContent = formatContent(content, 'client');
          setEditorContent(editor, htmlContent);
        }
      });
    }, [content, editor]);

    // Handle editable state change
    useEffect(() => {
      if (
        isNil(editor) ||
        editor.isDestroyed ||
        editor.isEditable === editable
      ) {
        return;
      }

      setTimeout(() => editor.setEditable(editable));
    }, [editable, editor]);

    // Handle RTL/LTR direction changes
    useEffect(() => {
      const editorWrapper = document.getElementById('block-editor-wrapper');
      if (!editorWrapper) {
        return;
      }
      editorWrapper.setAttribute('dir', i18n.dir());
      editorWrapper.style.textAlign = i18n.dir() === 'rtl' ? 'right' : 'left';
    }, [i18n]);

    // Function to update <p> tags (called when content changes)
    const updatePTags = () => {
      const pTags = document.querySelectorAll('div.tiptap p');

      pTags.forEach((pTag) => {
        const diffRemovedSpans = pTag.querySelectorAll('.diff-removed');

        // If there are diff-removed elements in the <p> tag, hide them
        if (diffRemovedSpans.length > 0) {
          diffRemovedSpans.forEach((span) => {
            const element = span as HTMLElement;
            element.style.display = 'none'; // Hide the removed content
          });
        }

        // If the <p> tag is empty after removing diff-removed spans, remove the <p> tag
        if ((pTag as HTMLElement).textContent?.trim() === '') {
          pTag.remove();
        }
      });
    };

    // Call the updatePTags function whenever editor content changes
    useEffect(() => {
      if (editor) {
        updatePTags();
      }
    }, [editor?.getHTML()]); // Trigger whenever editor's HTML content is updated

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
