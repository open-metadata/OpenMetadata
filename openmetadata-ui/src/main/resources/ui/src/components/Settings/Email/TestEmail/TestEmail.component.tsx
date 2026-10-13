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
    FormField,
    HookForm,
    Input,
    SimpleModal
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EMAIL_REG_EX } from '../../../../constants/regex.constants';
import { testEmailConnection } from '../../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

interface TesEmailProps {
  onCancel: () => void;
}

interface TestEmailFormValues {
  email: string;
}

const TestEmail = ({ onCancel }: TesEmailProps) => {
  const { t } = useTranslation();
  const form = useForm<TestEmailFormValues>({ defaultValues: { email: '' } });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (values: TestEmailFormValues) => {
    try {
      setIsLoading(true);
      const res = await testEmailConnection(values);
      showSuccessToast(res.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      onCancel();
    }
  };

  return (
    <SimpleModal
      isOpen
      data-testid="test-email-modal"
      isDismissable={false}
      isOkLoading={isLoading}
      okText={t('label.test')}
      title={t('label.test-email-connection')}
      onCancel={onCancel}
      onOk={form.handleSubmit(handleSubmit)}>
      <HookForm
        data-testid="test-email-form"
        form={form}
        id="test-email-form"
        onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField
          control={form.control}
          name="email"
          rules={{
            required: t('message.field-text-is-required', {
              fieldText: t('label.email'),
            }),
            pattern: {
              value: EMAIL_REG_EX,
              message: t('message.entity-is-not-valid', {
                entity: t('label.email'),
              }),
            },
          }}>
          {({ field, fieldState }) => (
            <Input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus first field of test-email form
              autoFocus
              isRequired
              hint={fieldState.error?.message}
              inputDataTestId="test-email-input"
              isInvalid={fieldState.invalid}
              label={t('label.email')}
              placeholder={t('label.enter-entity', {
                entity: t('label.email-lowercase'),
              })}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          )}
        </FormField>
      </HookForm>
    </SimpleModal>
  );
};

export default TestEmail;
