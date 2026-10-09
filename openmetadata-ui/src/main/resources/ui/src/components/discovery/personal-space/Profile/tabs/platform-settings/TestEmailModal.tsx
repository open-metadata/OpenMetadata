/*
 *  Copyright 2026 Collate.
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

import type { FieldProp } from '@openmetadata/ui-core-components';
import {
  Button,
  Dialog,
  FieldTypes,
  FormFields,
  HookForm,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EMAIL_REG_EX } from '../../../../../../constants/regex.constants';
import { testEmailConnection } from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';

interface TestEmailModalProps {
  onClose: () => void;
}

interface TestEmailFormValues {
  email: string;
}

const TestEmailModal = ({ onClose }: TestEmailModalProps) => {
  const { t } = useTranslation();
  const [isSending, setIsSending] = useState(false);
  const form = useForm<TestEmailFormValues>({ defaultValues: { email: '' } });

  const fields: FieldProp[] = useMemo(
    () => [
      {
        name: 'email',
        label: t('label.email'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder: t('label.enter-entity', {
          entity: t('label.email-lowercase'),
        }),
        props: { 'data-testid': 'test-email-input' },
        rules: {
          required: t('label.field-required', { field: t('label.email') }),
          pattern: {
            value: EMAIL_REG_EX,
            message: t('message.field-text-is-invalid', {
              fieldText: t('label.email'),
            }),
          },
        },
      },
    ],
    [t]
  );

  // Legacy behaviour: the modal closes once the test completes, pass or fail.
  const handleSubmit = async (values: TestEmailFormValues) => {
    setIsSending(true);
    try {
      const res = await testEmailConnection(values);
      showSuccessToast(res.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSending(false);
      onClose();
    }
  };

  const close = () => !isSending && onClose();

  return (
    <ModalOverlay
      isOpen
      isKeyboardDismissDisabled={isSending}
      onOpenChange={(open) => !open && close()}>
      <Modal>
        <Dialog
          data-testid="test-email-modal"
          dividers="scroll"
          showCloseButton={!isSending}
          title={t('label.test-email-connection')}
          width={480}
          onClose={close}>
          <HookForm
            data-testid="test-email-form"
            form={form}
            onSubmit={form.handleSubmit(handleSubmit)}>
            <Dialog.Content>
              <FormFields fields={fields} />
            </Dialog.Content>
            <Dialog.Footer>
              <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
                <Button
                  color="tertiary"
                  isDisabled={isSending}
                  size="sm"
                  onPress={onClose}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="test-email-submit"
                  isLoading={isSending}
                  size="sm"
                  type="submit">
                  {t('label.test')}
                </Button>
              </div>
            </Dialog.Footer>
          </HookForm>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default TestEmailModal;
