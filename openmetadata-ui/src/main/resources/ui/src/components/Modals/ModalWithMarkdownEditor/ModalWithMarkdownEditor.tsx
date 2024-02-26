/*
 *  Copyright 2022 Collate.
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

import { Button, Modal, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { FunctionComponent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import './modal-with-markdown-editor.less';
import {
  EditorContentRef,
  ModalWithMarkdownEditorProps,
} from './ModalWithMarkdownEditor.interface';

export const ModalWithMarkdownEditor: FunctionComponent<ModalWithMarkdownEditorProps> =
  ({
    header,
    placeholder,
    value,
    onSave,
    onCancel,
    visible,
  }: ModalWithMarkdownEditorProps) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const markdownRef = useRef<EditorContentRef>();

    const handleSaveData = async () => {
      if (markdownRef.current) {
        setIsLoading(true);
        try {
          await onSave?.(markdownRef.current?.getEditorContent().trim() ?? '');
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setIsLoading(false);
        }
      }
    };

    return (
      <Modal
        centered
        destroyOnClose
        className="description-markdown-editor"
        closable={false}
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
            onClick={handleSaveData}>
            {t('label.save')}
          </Button>,
        ]}
        maskClosable={false}
        open={visible}
        title={<Typography.Text data-testid="header">{header}</Typography.Text>}
        width="90%"
        onCancel={onCancel}>
        <RichTextEditor
          initialValue={value}
          placeHolder={placeholder}
          ref={markdownRef}
        />
      </Modal>
    );
  };
