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

import classnames from 'classnames';
import React, { FunctionComponent, useRef, useState } from 'react';
import { stringToDOMElement } from '../../../utils/StringsUtils';
import { Button } from '../../buttons/Button/Button';
import { MarkdownWithPreview } from '../../common/editor/MarkdownWithPreview';

type MarkdownRef = {
  fetchUpdatedHTML: () => string;
};

type Props = {
  isExpandable?: boolean;
  header: string;
  value: string;
  placeholder: string;
  onSave: (text: string) => void;
  onSuggest?: (text: string) => void;
  onCancel: () => void;
};

export const ModalWithMarkdownEditor: FunctionComponent<Props> = ({
  isExpandable = false,
  header,
  placeholder,
  value,
  onSave,
  // onSuggest,
  onCancel,
}: Props) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const markdownRef = useRef<MarkdownRef>();

  const getContainerClasses = () => {
    return classnames(
      'tw-modal-container',
      expanded ? ' tw-w-screen tw-h-screen tw-max-w-none' : null
    );
  };

  const handleSaveData = () => {
    if (markdownRef.current) {
      const updatedHTML = markdownRef.current.fetchUpdatedHTML();
      onSave(stringToDOMElement(updatedHTML).textContent ? updatedHTML : '');
    }
  };

  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop" />
      <div className={getContainerClasses()}>
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>
          {isExpandable && (
            <div className="tw-flex">
              <Button
                className="tw-text-lg tw-text-gray-900 hover:tw-text-gray-900"
                size="small"
                variant="text"
                onClick={() => setExpanded((value) => !value)}>
                {expanded ? (
                  <i aria-hidden="true" className="fa fa-window-minimize" />
                ) : (
                  <i aria-hidden="true" className="far fa-window-maximize" />
                )}
              </Button>
              <svg
                className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                onClick={onCancel}>
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="tw-modal-body tw-pt-0 tw-pb-1">
          <MarkdownWithPreview
            editorRef={(Ref: MarkdownRef) => (markdownRef.current = Ref)}
            placeholder={placeholder}
            value={value}
          />
        </div>
        <div className="tw-modal-footer">
          <Button
            size="regular"
            theme="primary"
            variant="link"
            onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="regular"
            theme="primary"
            variant="contained"
            onClick={() => handleSaveData()}>
            Save
          </Button>
        </div>
      </div>
    </dialog>
  );
};
