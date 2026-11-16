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
  FormField,
  FormItemLabel,
  HintText,
  HookForm,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { lazy, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
  const form = useForm<{ query: string }>({ defaultValues: { query: '' } });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const onFinish = async (value: { query: string }) => {
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
      form.reset({ query: value ?? '' });
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
              <HookForm form={form} onSubmit={form.handleSubmit(onFinish)}>
                <FormField
                  control={form.control}
                  name="query"
                  rules={{
                    required: t('label.field-required', {
                      field: t('label.sql-uppercase-query'),
                    }),
                  }}>
                  {({ field, fieldState }) => (
                    <Box
                      data-testid="sql-editor-container"
                      direction="col"
                      gap={1}>
                      <FormItemLabel
                        required
                        label={t('label.sql-uppercase-query')}
                      />
                      <SchemaEditor
                        className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                        mode={{ name: CSMode.SQL }}
                        showCopyButton={false}
                        value={field.value}
                        onChange={field.onChange}
                      />
                      {fieldState.error && (
                        <HintText isInvalid>
                          {fieldState.error.message}
                        </HintText>
                      )}
                    </Box>
                  )}
                </FormField>
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
