/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { convertFromRaw, convertToRaw, EditorState } from 'draft-js';
import { draftToMarkdown, markdownToDraft } from 'markdown-draft-js';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { Editor } from 'react-draft-wysiwyg';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import ListUl from '../../../assets/svg/list-ul.svg';
import { EditorProp, editorRef, Format } from './RichTextEditor.interface';
import { Bold, Info, Italic, Link } from './ToolBarOptions';

const getIntialContent = (format: string, content?: string) => {
  /*eslint-disable  */

  if (content) {
    switch (format) {
      case Format.MARKDOWN:
        const rawData = markdownToDraft(content, {
          remarkablePreset: 'commonmark',
          remarkableOptions: {
            html: false,
            disable: {
              inline: ['links', 'emphasis'],
              block: ['heading', 'code', 'list'],
            },
            enable: {
              block: 'table',
              core: ['abbr'],
            },
          },
          preserveNewlines: true,
        });
        const modifiedBlock = rawData.blocks.filter((data: any) => {
          if (data.text) {
            return data;
          }
        });

        const state = convertFromRaw({ ...rawData, blocks: modifiedBlock });

        return EditorState.createWithContent(state);

      case Format.JSON:
        const jsonData = convertFromRaw(JSON.parse(content));

        return EditorState.createWithContent(jsonData);

      default:
        return EditorState.createEmpty();
    }
  } else {
    return EditorState.createEmpty();
  }
};

const RichTextEditor = forwardRef<editorRef, EditorProp>(
  (
    {
      format = 'markdown',
      initvalue,
      readonly = false,
      customOptions,
    }: EditorProp,
    ref
  ) => {
    const [editorState, setEditorState] = useState(
      getIntialContent(format, initvalue)
    );
    const onEditorStateChange = (newState: typeof editorState) => {
      setEditorState(newState);
    };

    useImperativeHandle(ref, () => ({
      getEditorContent(format: 'json' | 'markdown') {
        switch (format) {
          case Format.MARKDOWN:
            return draftToMarkdown(
              convertToRaw(editorState.getCurrentContent())
            );

          case Format.JSON:
          default:
            return convertToRaw(editorState.getCurrentContent());
        }
      },
    }));

    useEffect(() => {
      setEditorState(getIntialContent(format, initvalue));
    }, [initvalue, format]);

    return (
      <>
        <div className="tw-min-h-32 tw-border tw-border-main tw-rounded tw-overflow-y-auto">
          <Editor
            editorClassName="tw-px-1 tw-min-h-32"
            editorState={editorState}
            readOnly={readonly}
            toolbar={{
              options: ['list'],
              list: {
                className: 'my-list tw-order-4',
                options: ['unordered'],
                unordered: {
                  icon: ListUl,
                  className: 'list-option ',
                },
              },
            }}
            toolbarClassName="tw-py-2 tw-border-0 tw-border-b tw-border-main"
            toolbarCustomButtons={
              customOptions ?? [
                <Bold key="bold" />,
                <Italic key="italic" />,
                <Link key="link" />,
                <Info key="info" />,
              ]
            }
            toolbarHidden={readonly}
            wrapperClassName="editor-wrapper"
            onEditorStateChange={onEditorStateChange}
          />
        </div>
      </>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
