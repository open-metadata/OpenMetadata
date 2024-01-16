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
import { Editor, EditorContent } from '@tiptap/react';
import { isNil } from 'lodash';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EDITOR_OPTIONS } from '../../constants/BlockEditor.constants';
import { formatContent } from '../../utils/BlockEditorUtils';
import './block-editor.less';
import { EditorSlotsRef } from './BlockEditor.interface';
import EditorSlots from './EditorSlots';
import { extensions } from './Extensions';
import { useCustomEditor } from './hooks/useCustomEditor';

export interface BlockEditorRef {
  editor: Editor | null;
}
export interface BlockEditorProps {
  content?: string;
  editable?: boolean;
  onChange?: (htmlContent: string) => void;
}

const BlockEditor = forwardRef<BlockEditorRef, BlockEditorProps>(
  ({ content = '', editable = true, onChange }, ref) => {
    const { i18n } = useTranslation();
    const editorSlots = useRef<EditorSlotsRef>(null);

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
        },
      },
    });

    useImperativeHandle(ref, () => ({
      editor,
    }));

    useEffect(() => {
      if (isNil(editor) || editor.isDestroyed || content === undefined) {
        return;
      }

      // We use setTimeout to avoid any flushSync console errors as
      // mentioned here https://github.com/ueberdosis/tiptap/issues/3764#issuecomment-1546854730
      setTimeout(() => {
        if (content !== undefined) {
          const htmlContent = formatContent(content, 'client');
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
      <div className="block-editor-wrapper" id="block-editor-wrapper">
        <EditorContent
          editor={editor}
          onMouseDown={editorSlots.current?.onMouseDown}
        />
        <EditorSlots editor={editor} ref={editorSlots} />
      </div>
    );
  }
);

export default BlockEditor;
