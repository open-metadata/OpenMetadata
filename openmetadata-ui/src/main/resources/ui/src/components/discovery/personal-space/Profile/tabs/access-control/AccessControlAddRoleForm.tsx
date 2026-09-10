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
  Autocomplete,
  Box,
  Button,
  Input,
  SelectItemType,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import type { Key } from 'react-aria-components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../../common/Loader/Loader';
import { ERROR_MESSAGE } from '../../../../../../constants/constants';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import { addRole, getPolicies } from '../../../../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../../../../utils/APIUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import type { AccessControlView } from './AccessControlPanel';

interface AccessControlAddRoleFormProps {
  onNavigate: (view: AccessControlView) => void;
}

const AccessControlAddRoleForm: React.FC<AccessControlAddRoleFormProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [nameError, setNameError] = useState('');

  const fetchPolicies = async () => {
    setIsLoadingPolicies(true);
    try {
      const data = await getPolicies(
        `${TabSpecificField.OWNERS},${TabSpecificField.ROLES}`,
        undefined,
        undefined,
        100
      );

      setPolicies(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingPolicies(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const policyItems = useMemo<SelectItemType[]>(
    () =>
      policies.map((p) => ({
        id: p.fullyQualifiedName ?? p.name,
        label: p.displayName || p.name,
      })),
    [policies]
  );

  const selectedPolicyItems = useMemo<SelectItemType[]>(
    () =>
      selectedPolicies.map((fqn) => {
        const match = policies.find(
          (p) => p.fullyQualifiedName === fqn || p.name === fqn
        );

        return { id: fqn, label: match?.displayName || match?.name || fqn };
      }),
    [selectedPolicies, policies]
  );

  const handleItemInserted = useCallback(
    (key: Key) => {
      setSelectedPolicies((prev) => [...prev, String(key)]);
    },
    []
  );

  const handleItemCleared = useCallback((key: Key) => {
    setSelectedPolicies((prev) => prev.filter((id) => id !== String(key)));
  }, []);

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
      await addRole({
        name: trimmedName,
        description,
        policies: selectedPolicies,
      });
      onNavigate({ type: 'roles' });
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.role'),
              entityPlural: t('label.role-lowercase-plural'),
              name: trimmedName,
            })
          : (error as AxiosError)
      );
    } finally {
      setIsSaveLoading(false);
    }
  };

  if (isLoadingPolicies) {
    return <Loader />;
  }

  return (
    <Box className="tw:flex tw:flex-col tw:h-full tw:min-h-0" direction="col">
      {/* Scrollable form area */}
      <Box
        className="tw:flex-1 tw:overflow-y-auto tw:p-6 tw:pt-0 tw:flex tw:flex-col tw:gap-5 tw:max-w-[50%] tw:w-full"
        data-testid="add-role-container"
        direction="col">
        <Box className="tw:flex tw:flex-col tw:gap-1" direction="col">
          <Typography
            className="tw:text-sm tw:font-medium tw:text-secondary"
            size="text-sm"
            weight="medium">
            {`${t('label.name')} *`}
          </Typography>
          <Input
            data-testid="role-name-input"
            placeholder={t('label.role-name')}
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
            data-testid="role-description-input"
            placeholder={t('message.write-your-description')}
            value={description}
            onChange={(value: string) => setDescription(value)}
          />
        </Box>

        <Box className="tw:flex tw:flex-col tw:gap-1" direction="col">
          <Typography
            className="tw:text-sm tw:font-medium tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.select-a-policy')}
          </Typography>
          <Autocomplete
            data-testid="role-policies-select"
            items={policyItems}
            placeholder={t('label.select-a-policy')}
            selectedItems={selectedPolicyItems}
            onItemCleared={handleItemCleared}
            onItemInserted={handleItemInserted}>
            {(item) => (
              <Autocomplete.Item id={item.id} key={item.id}>
                {item.label}
              </Autocomplete.Item>
            )}
          </Autocomplete>
        </Box>
      </Box>

      {/* Fixed footer */}
      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
        data-testid="add-role-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-btn"
          onPress={() => onNavigate({ type: 'roles' })}>
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

export default AccessControlAddRoleForm;
