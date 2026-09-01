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

import { Box, Button, PasswordInput } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequestType } from '../../../../../generated/auth/changePasswordRequest';
import { changePassword } from '../../../../../rest/auth-API';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import FieldRow from './FieldRow';
import { isPasswordValid } from './PasswordStrength.utils';
import PasswordStrengthMeter, {
  PASSWORD_FIELD_WIDTH_CLASS,
} from './PasswordStrengthMeter';

interface ChangePasswordRowProps {
  /** `User.name` of the signed-in user whose password is being changed. */
  username: string;
}

const EMPTY_FORM = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * The SECURITY section's only row. Collapsed it shows a "Change Password"
 * link; expanded it reveals the current / new / confirm fields with a live
 * strength meter, and PUTs `/users/changePassword` as a `SELF` request.
 */
const ChangePasswordRow: React.FC<ChangePasswordRowProps> = ({ username }) => {
  const { t } = useTranslation();
  // Reused as the `entity` interpolation for the row title, submit button and
  // success toast.
  const entityLabel = t('label.password');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const isMismatch = useMemo(
    () =>
      Boolean(form.confirmPassword) &&
      form.confirmPassword !== form.newPassword,
    [form.confirmPassword, form.newPassword]
  );

  const canSubmit =
    Boolean(form.oldPassword) &&
    isPasswordValid(form.newPassword) &&
    form.confirmPassword === form.newPassword;

  const setField = useCallback(
    (key: keyof typeof EMPTY_FORM) => (value: string) =>
      setForm((previous) => ({ ...previous, [key]: value })),
    []
  );

  const closeForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setIsEditing(false);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSaving(true);
      try {
        await changePassword({
          ...form,
          username,
          requestType: RequestType.Self,
        });
        showSuccessToast(
          t('server.update-entity-success', { entity: entityLabel })
        );
        closeForm();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [form, username, closeForm, entityLabel, t]
  );

  return (
    <Box
      className="tw:w-full tw:px-5 tw:py-4"
      data-testid="change-password-row"
      direction="col"
      gap={5}>
      <FieldRow
        description={t('message.password-description')}
        title={entityLabel}>
        {!isEditing && (
          <Button
            color="link-color"
            data-testid="change-password-button"
            size="sm"
            onClick={() => setIsEditing(true)}>
            {t('label.change-password')}
          </Button>
        )}
      </FieldRow>

      {isEditing && (
        <form noValidate onSubmit={handleSubmit}>
          {/*
            The column is full width so the strength meter's rule checklist can
            use the whole card and stay on one line; every field is capped at
            the narrower field width instead.
          */}
          <Box className="tw:w-full" direction="col" gap={5}>
            <div className={PASSWORD_FIELD_WIDTH_CLASS}>
              <PasswordInput
                isRequired
                autoComplete="current-password"
                data-testid="current-password-input"
                label={t('label.current-password')}
                value={form.oldPassword}
                onChange={setField('oldPassword')}
              />
            </div>
            <Box className="tw:w-full" direction="col" gap={2}>
              <div className={PASSWORD_FIELD_WIDTH_CLASS}>
                <PasswordInput
                  isRequired
                  autoComplete="new-password"
                  data-testid="new-password-input"
                  label={t('label.new-password')}
                  value={form.newPassword}
                  onChange={setField('newPassword')}
                />
              </div>
              {Boolean(form.newPassword) && (
                <PasswordStrengthMeter password={form.newPassword} />
              )}
            </Box>
            <div className={PASSWORD_FIELD_WIDTH_CLASS}>
              <PasswordInput
                isRequired
                autoComplete="new-password"
                data-testid="confirm-password-input"
                hint={isMismatch ? t('label.password-not-match') : undefined}
                isInvalid={isMismatch}
                label={t('label.confirm-new-password')}
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
              />
            </div>
            <Box gap={3}>
              <Button
                color="primary"
                data-testid="update-password-button"
                isDisabled={!canSubmit}
                isLoading={isSaving}
                size="sm"
                type="submit">
                {t('label.update-entity', { entity: entityLabel })}
              </Button>
              <Button
                color="secondary"
                data-testid="cancel-change-password-button"
                size="sm"
                type="button"
                onClick={closeForm}>
                {t('label.cancel')}
              </Button>
            </Box>
          </Box>
        </form>
      )}
    </Box>
  );
};

export default ChangePasswordRow;
