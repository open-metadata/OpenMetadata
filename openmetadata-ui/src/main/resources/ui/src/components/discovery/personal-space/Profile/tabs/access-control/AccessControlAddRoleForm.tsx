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
    Typography
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFilter } from 'react-aria';
import type { Key } from 'react-aria-components';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ERROR_MESSAGE } from '../../../../../../constants/constants';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import { addRole, getPolicies } from '../../../../../../rest/rolesAPIV1';
import { getIsErrorMatch } from '../../../../../../utils/APIUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import Loader from '../../../../../common/Loader/Loader';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import type { AccessControlView } from './AccessControlPanel';

interface FormValues {
  name: string;
}

interface AccessControlAddRoleFormProps {
  onNavigate: (view: AccessControlView) => void;
}

const AccessControlAddRoleForm: React.FC<AccessControlAddRoleFormProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { contains } = useFilter({ sensitivity: 'base' });
  const descEditorRef = useRef<EditorContentRef>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<FormValues>({
    defaultValues: { name: '' },
  });

  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);

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

  const handleItemInserted = useCallback((key: Key) => {
    setSelectedPolicies((prev) => [...prev, String(key)]);
  }, []);

  const handleItemCleared = useCallback((key: Key) => {
    setSelectedPolicies((prev) => prev.filter((id) => id !== String(key)));
  }, []);

  const onSubmit = async (data: FormValues) => {
    const description = descEditorRef.current?.getEditorContent() ?? '';

    setIsSaveLoading(true);
    try {
      await addRole({
        name: data.name.trim(),
        description,
        policies: selectedPolicies,
      });
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.role') })
      );
      onNavigate({ type: 'roles' });
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.role'),
              entityPlural: t('label.role-lowercase-plural'),
              name: data.name.trim(),
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
    <Box className="tw:h-full tw:min-h-0" direction="col">
      {/* Scrollable form area */}
      <Box
        className="tw:flex-1 tw:overflow-y-auto tw:p-6 tw:pt-0 tw:max-w-[50%] tw:w-full"
        data-testid="add-role-container"
        direction="col"
        gap={5}>
        <Box direction="col" gap={1}>
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
                data-testid="role-name-input"
                placeholder={t('label.role-name')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
            rules={{ required: t('label.field-required', { field: t('label.name') }) }}
          />
          {errors.name && (
            <Typography className="tw:text-xs tw:text-red-500">
              {errors.name.message}
            </Typography>
          )}
        </Box>

        <Box direction="col" gap={1}>
          <Typography
            className="tw:text-sm tw:font-medium tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.description')}
          </Typography>
          <RichTextEditor
            className="new-form-style"
            data-testid="role-description-input"
            placeHolder={t('message.write-your-description')}
            ref={descEditorRef}
          />
        </Box>

        <Box direction="col" gap={1}>
          <Typography
            className="tw:text-sm tw:font-medium tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.select-a-policy')}
          </Typography>
          <Autocomplete
            data-testid="role-policies-select"
            filterOption={(item, filterText) =>
              contains(item.label || '', filterText) ||
              contains(String(item.id), filterText)
            }
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
          onPress={() => handleSubmit(onSubmit)()}>
          {t('label.create')}
        </Button>
      </Box>
    </Box>
  );
};

export default AccessControlAddRoleForm;
