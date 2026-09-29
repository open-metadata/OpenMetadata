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
  Box,
  Button,
  FieldTypes,
  FormFields,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EMAIL_REG_EX } from '../../../../../../constants/regex.constants';
import { AuthType } from '../../../../../../generated/api/teams/createUser';
import { JWTTokenExpiry } from '../../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../../hooks/authHooks';
import { createBot } from '../../../../../../rest/botsAPI';
import { createUserWithPut } from '../../../../../../rest/userAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import type { BotsView } from './BotsPanel.types';
import { TOKEN_EXPIRY_OPTIONS } from './BotToken.constants';

interface BotAddFormProps {
  onNavigate: (view: BotsView) => void;
}

interface BotFormValues {
  email: string;
  displayName: string;
  tokenExpiry: { id: string; label?: string } | null;
  allowImpersonation: boolean;
}

const BotAddForm: React.FC<BotAddFormProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionRef = useRef<EditorContentRef>(null);

  const form = useForm<BotFormValues>({
    defaultValues: {
      email: '',
      displayName: '',
      tokenExpiry: null,
      allowImpersonation: false,
    },
  });

  const tokenExpiryOptions = useMemo(
    () =>
      TOKEN_EXPIRY_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(opt.labelKey, opt.labelParams),
      })),
    [t]
  );

  const nameFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'email',
        label: t('label.email'),
        type: FieldTypes.TEXT,
        required: true,
        props: { 'data-testid': 'email' },
        rules: {
          required: t('label.field-required', { field: t('label.email') }),
          pattern: {
            value: EMAIL_REG_EX,
            message: t('message.entity-name-validation'),
          },
        },
      },
      {
        name: 'displayName',
        label: t('label.display-name'),
        type: FieldTypes.TEXT,
        required: false,
        props: { 'data-testid': 'displayName' },
      },
    ],
    [t]
  );

  const tokenFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'tokenExpiry',
        label: t('label.token-expiration'),
        type: FieldTypes.SELECT,
        required: true,
        props: {
          'data-testid': 'token-expiry',
          items: tokenExpiryOptions,
        },
        rules: {
          required: t('label.field-required', {
            field: t('label.token-expiration'),
          }),
        },
      },
    ],
    [t, tokenExpiryOptions]
  );

  const switchFields: FieldProp[] = useMemo(
    () =>
      isAdminUser
        ? [
            {
              name: 'allowImpersonation',
              label: t('label.allow-impersonation'),
              type: FieldTypes.SWITCH,
              required: false,
              helperText: t('message.allow-impersonation-help'),
              props: { 'data-testid': 'allow-impersonation' },
            },
          ]
        : [],
    [isAdminUser, t]
  );

  const handleSubmit = useCallback(
    async (values: BotFormValues) => {
      setIsSubmitting(true);

      try {
        const botName = values.email.split('@')[0];
        const description =
          descriptionRef.current?.getEditorContent() || undefined;

        // Step 1: Create the bot user
        await createUserWithPut({
          email: values.email,
          name: botName,
          displayName: values.displayName || undefined,
          description,
          isAdmin: false,
          isBot: true,
          botName,
          domains: [],
          authenticationMechanism: {
            authType: AuthType.Jwt,
            config: {
              JWTTokenExpiry: (values.tokenExpiry?.id ??
                JWTTokenExpiry.OneHour) as JWTTokenExpiry,
            },
          },
        });

        // Step 2: Create the bot entity. Data-dependent on step 1 — the bot
        // entity references the bot user by name, so the user must exist first.
        // eslint-disable-next-line openmetadata-imports/review-sequential-api-calls
        await createBot({
          botUser: botName,
          name: botName,
          displayName: values.displayName || undefined,
          description,
          allowImpersonation: values.allowImpersonation,
        });

        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.bot') })
        );
        onNavigate({ type: 'list' });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onNavigate, t]
  );

  return (
    <HookForm
      className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:justify-between"
      data-testid="bot-add-form"
      form={form}>
      <div className="tw:overflow-y-auto">
        <Box
          className="tw:flex-1 tw:p-6 tw:pt-0 tw:max-w-[50%] tw:w-full"
          direction="col"
          gap={5}>
          <FormFields fields={nameFields} />

          <Box direction="col" gap={1}>
            <Typography
              className="tw:text-secondary"
              size="text-sm"
              weight="medium">
              {t('label.description')}
            </Typography>
            <RichTextEditor
              className="new-form-style"
              data-testid="description-input"
              placeHolder={t('message.write-your-description')}
              ref={descriptionRef}
            />
          </Box>

          <FormFields fields={tokenFields} />
          <FormFields fields={switchFields} />
        </Box>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
        data-testid="add-bot-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-btn"
          onPress={() => onNavigate({ type: 'list' })}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="submit-btn"
          isLoading={isSubmitting}
          onPress={form.handleSubmit(handleSubmit)}>
          {t('label.create')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default BotAddForm;
