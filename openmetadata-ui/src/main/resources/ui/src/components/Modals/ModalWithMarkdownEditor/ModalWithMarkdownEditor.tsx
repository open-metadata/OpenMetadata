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
import { Button, Modal, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { FunctionComponent, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import CloseWhatNewIconComponent from '../CloseWhatNewIconComponent';
import {
  EditorContentRef,
  ModalWithMarkdownEditorProps,
} from './ModalWithMarkdownEditor.interface';
import './ModalWithMarkdownEditor.style.less';

export const ModalWithMarkdownEditor: FunctionComponent<ModalWithMarkdownEditorProps> =
  ({
    isExpandable = false,
    header,
    placeholder,
    value,
    onSave,
    onCancel,
    visible,
  }: ModalWithMarkdownEditorProps) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const markdownRef = useRef<EditorContentRef>();

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
      <Modal
        centered
        destroyOnClose
        className="description-markdown-editor"
        closable={isExpandable}
        closeIcon={
          <div className="inline-flex mr-4">
            <Button
              className="text-lg"
              size="small"
              onClick={() => setExpanded((value) => !value)}>
              <FontAwesomeIcon
                icon={expanded ? faWindowMinimize : faWindowMaximize}
              />
            </Button>
            <CloseWhatNewIconComponent
              dataTestId="markdown-editor-cancel-button"
              handleCancel={onCancel}
            />
          </div>
        }
        data-testid="markdown-editor"
        footer={[
          <Button
            data-testid="cancel"
            disabled={isLoading}
            key="cancelButton"
            type="link"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>,
          <Button
            data-testid="save"
            key="saveButton"
            loading={isLoading}
            type="primary"
            onClick={() => handleSaveData()}>
            {t('label.save')}
          </Button>,
        ]}
        title={
          <Typography.Text strong data-testid="header">
            {header}
          </Typography.Text>
        }
        visible={visible}
        width={expanded ? undefined : 1300}
        wrapClassName={expanded ? 'description-markdown-editor-wrap' : ''}>
        <RichTextEditor
          initialValue={value}
          placeHolder={placeholder}
          ref={markdownRef}
        />
      </Modal>,
      document.body
    );
  };
