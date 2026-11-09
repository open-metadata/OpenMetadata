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

import {
  Button,
  ConfirmPopover,
  Input,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EMAIL_REG_EX } from '../../../../../../constants/regex.constants';
import { testEmailConnection } from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';

interface TestEmailFormValues {
  email: string;
}

const TestEmailPopover = () => {
  const { t } = useTranslation();
  const form = useForm<TestEmailFormValues>({ defaultValues: { email: '' } });

  // Legacy behaviour: the popover closes once the test completes, pass or fail.
  const handleConfirm = async () => {
    if (!(await form.trigger())) {
      return false;
    }
    try {
      const res = await testEmailConnection(form.getValues());
      showSuccessToast(res.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }

    return true;
  };

  return (
    <ConfirmPopover
      asForm
      confirmText={t('label.test')}
      content={
        // ConfirmPopover renders the <form> (Enter submits), so only the field goes here.
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              isRequired
              data-testid="test-email-input"
              hint={fieldState.error?.message}
              isInvalid={fieldState.invalid}
              label={t('label.email')}
              name={field.name}
              placeholder={t('label.enter-entity', {
                entity: t('label.email-lowercase'),
              })}
              validationBehavior="aria"
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          )}
          rules={{
            required: t('label.field-required', { field: t('label.email') }),
            pattern: {
              value: EMAIL_REG_EX,
              message: t('message.field-text-is-invalid', {
                fieldText: t('label.email'),
              }),
            },
          }}
        />
      }
      data-testid="test-email-popover"
      title={t('label.test-email-connection')}
      variant="primary"
      onConfirm={handleConfirm}
      onOpenChange={(isOpen) => !isOpen && form.reset()}>
      <Button color="secondary" data-testid="test-email-button" size="xs">
        {t('label.test-email')}
      </Button>
    </ConfirmPopover>
  );
};

export default TestEmailPopover;
