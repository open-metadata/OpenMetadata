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

    // this hook to initialize the editor
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
