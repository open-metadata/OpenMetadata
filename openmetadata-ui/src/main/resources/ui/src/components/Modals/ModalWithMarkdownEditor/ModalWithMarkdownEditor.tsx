/*
 *  Copyright 2021 Collate
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

import {
  faWindowMaximize,
  faWindowMinimize,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from 'antd';
import { AxiosError } from 'axios';
import classnames from 'classnames';
import React, { FunctionComponent, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import Loader from '../../Loader/Loader';

type EditorContentRef = {
  getEditorContent: () => string;
};

type Props = {
  isExpandable?: boolean;
  header: string;
  value: string;
  placeholder: string;
  onSave?: (text: string) => Promise<void>;
  onCancel?: () => void;
};

export const ModalWithMarkdownEditor: FunctionComponent<Props> = ({
  isExpandable = false,
  header,
  placeholder,
  value,
  onSave,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const markdownRef = useRef<EditorContentRef>();

  const getContainerClasses = () => {
    return classnames(
      'tw-modal-container',
      expanded ? ' tw-w-screen tw-h-screen tw-max-w-none' : null
    );
  };

  const handleSaveData = async () => {
    if (markdownRef.current) {
      setIsLoading(true);
      try {
        await onSave?.(markdownRef.current?.getEditorContent() ?? '');
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return ReactDOM.createPortal(
    <dialog className="tw-modal" data-testid="markdown-editor">
      <div className="tw-modal-backdrop" />
      <div className={getContainerClasses()}>
        <div className="tw-modal-header">
          <p className="tw-modal-title" data-testid="header">
            {header}
          </p>
          {isExpandable && (
            <div className="tw-flex">
              <Button
                className="tw-text-lg tw-text-gray-900 hover:tw-text-gray-900"
                size="small"
                onClick={() => setExpanded((value) => !value)}>
                <FontAwesomeIcon
                  icon={expanded ? faWindowMinimize : faWindowMaximize}
                />
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
        <div className="tw-modal-body">
          <RichTextEditor
            initialValue={value}
            placeHolder={placeholder}
            ref={markdownRef}
          />
        </div>
        <div className="tw-modal-footer">
          <Button
            data-testid="cancel"
            disabled={isLoading}
            type="link"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="save"
            type="primary"
            onClick={() => handleSaveData()}>
            {isLoading ? <Loader size="small" type="white" /> : t('label.save')}
          </Button>
        </div>
      </div>
    </dialog>,
    document.body
  );
};
