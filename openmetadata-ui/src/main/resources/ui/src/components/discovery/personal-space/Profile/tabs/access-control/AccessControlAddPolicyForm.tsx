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
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import React, { Dispatch, SetStateAction, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreatePolicy,
  Effect,
  Rule,
} from '../../../../../../generated/api/policies/createPolicy';
import { addPolicy } from '../../../../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../../../../utils/APIUtils';
import { ERROR_MESSAGE } from '../../../../../../constants/constants';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import AccessControlRuleForm from './AccessControlRuleForm';
import type { AccessControlView } from './AccessControlPanel';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleData, setRuleData] = useState<Rule>(INITIAL_RULE);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [nameError, setNameError] = useState('');

  const handleSubmit = async () => {
    const trimmedName = trim(name);

    if (!trimmedName) {
      setNameError(
        t('label.field-required', { field: t('label.name') })
      );

      return;
    }

    setNameError('');
    setIsSaveLoading(true);

    try {
      const { condition, ...rest } = {
        ...ruleData,
        name: trim(ruleData.name),
      };
      const data: CreatePolicy = {
        name: trimmedName,
        description,
        rules: [condition ? { ...rest, condition } : rest],
      };
      await addPolicy(data);
      onNavigate({ type: 'policies' });
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.policy'),
              entityPlural: t('label.policy-plural'),
              name: trim(name),
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
      <div className='tw:overflow-y-auto'>
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
          <Input
            data-testid="policy-name-input"
            placeholder={t('label.policy-name')}
            value={name}
            onChange={(value) => {
              setName(value);

              if (value.trim()) {
                setNameError('');
              }
            }}
          />
          {nameError && (
            <Typography className="tw:text-xs tw:text-red-500">
              {nameError}
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
          <TextArea
            data-testid="policy-description-input"
            placeholder={t('message.write-your-description')}
            value={description}
            onChange={(value: string) => setDescription(value)}
          />
        </Box>
        {/* Rule section — reuse existing RuleForm component */}
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
            setRuleData={
              setRuleData as Dispatch<SetStateAction<Rule>>
            }
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
          onPress={handleSubmit}>
          {t('label.create')}
        </Button>
      </Box>
    </Box>
  );
};

export default AccessControlAddPolicyForm;
