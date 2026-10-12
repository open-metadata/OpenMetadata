/*
 *  Copyright 2024 Collate.
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
import { Dialog, Modal, ModalOverlay } from '@openmetadata/ui-core-components';
import { Button, Form } from 'antd';
import { FormProps, useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import Loader from '../../common/Loader/Loader';
import { ModalWithQueryEditorProps } from './ModalWithQueryEditor.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor'))
);

export const ModalWithQueryEditor = ({
  header,
  value,
  onSave,
  onCancel,
  visible,
}: ModalWithQueryEditorProps) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const onFinish: FormProps['onFinish'] = async (value) => {
    setIsSaving(true);
    try {
      await onSave?.(value.query ?? '');
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ query: value });
      setIsLoading(false);
    }
  }, [form, visible]);

  return (
    // Opens from the lineage edge drawer (a z-999 SlideoutMenu), so the
    // overlay has to sit above it.
    <ModalOverlay
      className="tw:z-1000"
      isDismissable={false}
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel?.()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="markdown-editor"
          title={header}
          width={1200}
          onClose={() => onCancel?.()}>
          <Dialog.Content>
            {isLoading ? (
              <Loader />
            ) : (
              <Form form={form} layout="vertical" onFinish={onFinish}>
                <Form.Item
                  data-testid="sql-editor-container"
                  label={t('label.sql-uppercase-query')}
                  name="query"
                  rules={[
                    {
                      required: true,
                      message: t('label.field-required', {
                        field: t('label.sql-uppercase-query'),
                      }),
                    },
                  ]}
                  trigger="onChange">
                  <SchemaEditor
                    className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                    mode={{ name: CSMode.SQL }}
                    showCopyButton={false}
                  />
                </Form.Item>
              </Form>
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              data-testid="cancel"
              disabled={isLoading}
              key="cancelButton"
              type="link"
              onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="save"
              key="saveButton"
              type="primary"
              onClick={() => form.submit()}>
              {isSaving ? (
                <Loader size="small" type="white" />
              ) : (
                t('label.save')
              )}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
