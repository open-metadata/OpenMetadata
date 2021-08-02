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

import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { deserializeData } from '../../../utils/EditorUtils';
import { stringToDOMElement, stringToHTML } from '../../../utils/StringsUtils';
import MarkdownEditor from './Editor';

type MarkdownWithPreview = {
  fetchUpdatedHTML: () => string;
};

type Props = {
  value: string;
  placeholder: string;
  editorRef: Function;
};

const getDeserializedNodes = (strElm: string): Array<Node> => {
  const domElm = stringToDOMElement(`<div>${strElm}</div>`);

  return deserializeData(domElm.childNodes[0]);
};

export const MarkdownWithPreview: FunctionComponent<Props> = ({
  editorRef,
  placeholder,
  value,
}: Props) => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [preview, setPreview] = useState<string>('');
  const [initValue, setInitValue] = useState<Array<Node>>(
    getDeserializedNodes(value || ' ')
  );
  const markdownRef = useRef<MarkdownWithPreview>();

  const getTabClasses = (tab: number, activeTab: number) => {
    return (
      'tw-gh-tabs tw-cursor-pointer' + (activeTab === tab ? ' active' : '')
    );
  };

  const getPreviewHTML = useCallback(() => {
    return stringToHTML(preview);
  }, [preview]);

  const updateInternalValue = () => {
    if (markdownRef.current) {
      const updatedHTML = markdownRef.current.fetchUpdatedHTML();
      setInitValue(
        getDeserializedNodes(
          stringToDOMElement(updatedHTML).textContent ? updatedHTML : ''
        )
      );
      setPreview(updatedHTML);
    }
  };

  const handleSaveData = () => {
    if (markdownRef.current) {
      const updatedHTML = markdownRef.current.fetchUpdatedHTML();

      return stringToDOMElement(updatedHTML).textContent ? updatedHTML : '';
    } else {
      return '';
    }
  };
  useEffect(() => {
    if (typeof editorRef === 'function') {
      editorRef({
        fetchUpdatedHTML: () => {
          return handleSaveData();
        },
      });
    }
  }, []);

  return (
    <>
      <div className="tw-bg-transparent">
        <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-6">
          <p
            className={getTabClasses(1, activeTab)}
            data-testid="tab"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(1);
            }}>
            {'Write '}
          </p>
          <p
            className={getTabClasses(2, activeTab)}
            data-testid="tab"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(2);
              updateInternalValue();
            }}>
            {'View '}
          </p>
        </nav>
      </div>
      <div className="tw-py-5">
        {activeTab === 1 && (
          <MarkdownEditor
            className=""
            contentListClasses="tw-z-9999"
            editorRef={(ref) => (markdownRef.current = ref)}
            initValue={initValue}
            placeholder={placeholder}
          />
        )}
        {activeTab === 2 && (
          <div className="editor-wrapper tw-flex tw-flex-col tw-flex-1 tw-overflow-y-auto tw-p-3 tw-min-h-32 tw-border tw-border-gray-300 tw-rounded tw-max-h-none">
            {getPreviewHTML()}
          </div>
        )}
      </div>
    </>
  );
};
