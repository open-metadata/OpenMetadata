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
    Box,
    Button,
    Input,
    Typography
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import React, { Dispatch, SetStateAction, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ERROR_MESSAGE } from '../../../../../../constants/constants';
import {
    CreatePolicy,
    Effect,
    Rule
} from '../../../../../../generated/api/policies/createPolicy';
import { addPolicy } from '../../../../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../../../../utils/APIUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import type { AccessControlView } from './AccessControlPanel';
import AccessControlRuleForm from './AccessControlRuleForm';

interface FormValues {
  name: string;
}

interface AccessControlAddPolicyFormProps {
  onNavigate: (view: AccessControlView) => void;
}

const INITIAL_RULE: Rule = {
  name: '',
  description: '',
  resources: [],
  operations: [],
  condition: '',
  effect: Effect.Allow,
};

const AccessControlAddPolicyForm: React.FC<
  AccessControlAddPolicyFormProps
> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const descEditorRef = useRef<EditorContentRef>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<FormValues>({
    defaultValues: { name: '' },
  });

  const [ruleData, setRuleData] = useState<Rule>(INITIAL_RULE);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  const onSubmit = async (data: FormValues) => {
    const trimmedName = trim(data.name);
    const description = descEditorRef.current?.getEditorContent() ?? '';

    setIsSaveLoading(true);
    try {
      const { condition, ...rest } = {
        ...ruleData,
        name: trim(ruleData.name),
      };
      const payload: CreatePolicy = {
        name: trimmedName,
        description,
        rules: [condition ? { ...rest, condition } : rest],
      };
      await addPolicy(payload);
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.policy') })
      );
      onNavigate({ type: 'policies' });
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.policy'),
              entityPlural: t('label.policy-plural'),
              name: trim(data.name),
            })
          : (error as AxiosError)
      );
    } finally {
      setIsSaveLoading(false);
    }
  };

  return (
    <Box className="tw:flex tw:flex-col tw:h-full tw:min-h-0" direction="col">
      {/* Scrollable form area */}
      <div className="tw:overflow-y-auto">
        <Box
          className="tw:flex-1 tw:p-6 tw:flex tw:flex-col tw:gap-5 tw:max-w-[50%] tw:w-full tw:pt-0"
          data-testid="add-policy-container"
          direction="col">
          <Box className="tw:flex tw:flex-col tw:gap-1" direction="col">
            <Typography
              className="tw:text-sm tw:font-medium tw:text-secondary"
              size="text-sm"
              weight="medium">
              {`${t('label.name')} *`}
            </Typography>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  data-testid="policy-name-input"
                  placeholder={t('label.policy-name')}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
              rules={{
                required: t('label.field-required', { field: t('label.name') }),
              }}
            />
            {errors.name && (
              <Typography className="tw:text-xs tw:text-red-500">
                {errors.name.message}
              </Typography>
            )}
          </Box>

          <Box className="tw:flex tw:flex-col tw:gap-1" direction="col">
            <Typography
              className="tw:text-sm tw:font-medium tw:text-secondary"
              size="text-sm"
              weight="medium">
              {t('label.description')}
            </Typography>
            <RichTextEditor
              className="new-form-style"
              data-testid="policy-description-input"
              placeHolder={t('message.write-your-description')}
              ref={descEditorRef}
            />
          </Box>

          {/* Rule section */}
          <Box className="tw:flex tw:flex-col tw:gap-3" direction="col">
            <Box
              className="tw:border-t tw:border-secondary tw:pt-4"
              direction="col">
              <Typography
                className="tw:text-sm tw:font-semibold tw:text-primary"
                size="text-sm"
                weight="semibold">
                {t('label.add-entity', { entity: t('label.rule') })}
              </Typography>
            </Box>
            <AccessControlRuleForm
              ruleData={ruleData}
              setRuleData={setRuleData as Dispatch<SetStateAction<Rule>>}
            />
          </Box>
        </Box>
      </div>

      {/* Fixed footer */}
      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
        data-testid="add-policy-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-btn"
          onPress={() => onNavigate({ type: 'policies' })}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="submit-btn"
          isLoading={isSaveLoading}
          onPress={() => handleSubmit(onSubmit)()}>
          {t('label.create')}
        </Button>
      </Box>
    </Box>
  );
};

export default AccessControlAddPolicyForm;
