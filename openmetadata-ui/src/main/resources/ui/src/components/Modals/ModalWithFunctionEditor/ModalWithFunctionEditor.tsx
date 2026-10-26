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
import {
  Box,
  Button,
  Dialog,
  FieldTypes,
  FormFields,
  HookForm,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import { ModalWithFunctionEditorProps } from './ModalWithFunctionEditor.interface';

export const ModalWithFunctionEditor = ({
  header,
  value,
  onSave,
  onCancel,
  visible,
}: ModalWithFunctionEditorProps) => {
  const { t } = useTranslation();
  const form = useForm<{ functionValue: string }>({
    defaultValues: { functionValue: '' },
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const onFinish = async (values: { functionValue: string }) => {
    setIsSaving(true);
    try {
      await onSave?.(values.functionValue ?? '');
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (visible) {
      form.reset({ functionValue: value ?? '' });
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
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="function-editor-modal"
          title={header}
          width={700}
          onClose={onCancel}>
          <Dialog.Content>
            {isLoading ? (
              <Loader />
            ) : (
              <HookForm form={form} onSubmit={form.handleSubmit(onFinish)}>
                <Box data-testid="function-editor-container" direction="col">
                  <FormFields
                    fields={[
                      {
                        name: 'functionValue',
                        label: t('label.sql-function'),
                        type: FieldTypes.TEXT,
                        required: true,
                        placeholder: t('label.enter-entity', {
                          entity: t('label.sql-function'),
                        }),
                        props: { inputDataTestId: 'sql-function-input' },
                        rules: {
                          required: t('label.field-required', {
                            field: t('label.sql-function'),
                          }),
                        },
                      },
                    ]}
                  />
                </Box>
              </HookForm>
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="cancel"
              isDisabled={isLoading}
              key="cancelButton"
              onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save"
              key="saveButton"
              onClick={form.handleSubmit(onFinish)}>
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

export default ModalWithFunctionEditor;
