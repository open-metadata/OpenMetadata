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

import {
    Box,
    FormField,
    HookForm,
    PasswordInput,
    SimpleModal
} from '@openmetadata/ui-core-components';
import React from 'react';
import { RegisterOptions, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { passwordRegex } from '../../../constants/regex.constants';
import { ChangePasswordRequest } from '../../../generated/auth/changePasswordRequest';

interface ChangePasswordFormProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (data: ChangePasswordRequest) => void;
  isLoggedInUser: boolean;
  isLoading: boolean;
}

type PasswordField = 'oldPassword' | 'newPassword' | 'confirmPassword';

const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  visible,
  onCancel,
  onSave,
  isLoggedInUser,
  isLoading,
}) => {
  const { t } = useTranslation();
  // Unregister unmounted fields so a hidden old-password field is not sent.
  const form = useForm<ChangePasswordRequest>({ shouldUnregister: true });
  const handleSave = form.handleSubmit((data) => onSave(data));

  const renderPasswordField = (
    name: PasswordField,
    label: string,
    placeholder: string,
    testId: string,
    rules: RegisterOptions<ChangePasswordRequest, PasswordField>
  ) => (
    <FormField control={form.control} name={name} rules={rules}>
      {({ field, fieldState }) => (
        <PasswordInput
          autoComplete="off"
          hint={fieldState.error?.message}
          inputDataTestId={testId}
          isInvalid={fieldState.invalid}
          isRequired={Boolean(rules.required)}
          label={label}
          placeholder={placeholder}
          value={field.value ?? ''}
          onBlur={field.onBlur}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );

  const requiredRule = (label: string) =>
    t('message.field-text-is-required', { fieldText: label });

  return (
    <SimpleModal
      cancelText={t('label.cancel')}
      data-testid="modal-container"
      isDismissable={false}
      isOkLoading={isLoading}
      isOpen={visible}
      okText={t('label.update-entity', { entity: t('label.password') })}
      title={t('label.change-entity', {
        entity: t('label.password'),
      })}
      width={500}
      onCancel={() => {
        form.reset();
        onCancel();
      }}
      onOk={handleSave}>
      <HookForm
        form={form}
        id="change-password-form"
        onSubmit={handleSave}>
        <Box direction="col" gap={4}>
          {isLoggedInUser &&
            renderPasswordField(
              'oldPassword',
              t('label.old-password'),
              t('label.enter-type-password', { type: t('label.old') }),
              'input-oldPassword',
              { required: requiredRule(t('label.old-password')) }
            )}
          {renderPasswordField(
            'newPassword',
            t('label.new-password'),
            t('label.enter-type-password', { type: t('label.new') }),
            'input-newPassword',
            {
              required: requiredRule(t('label.new-password')),
              // passwordRegex is global, so a shared instance keeps lastIndex
              // between tests; test against a fresh copy.
              validate: (value) =>
                new RegExp(passwordRegex.source).test(value ?? '') ||
                t('message.password-error-message'),
            }
          )}
          {renderPasswordField(
            'confirmPassword',
            t('label.confirm-new-password'),
            t('label.confirm-new-password'),
            'input-confirm-newPassword',
            {
              validate: (value, values) =>
                value === values.newPassword || t('label.password-not-match'),
            }
          )}
        </Box>
      </HookForm>
    </SimpleModal>
  );
};

export default ChangePasswordForm;
