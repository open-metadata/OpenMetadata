/*
 *  Copyright 2023 Collate.
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
  FormField,
  FormItemLabel,
  HookForm,
  Input,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { trim } from 'lodash';
import { useState } from 'react';
import { RegisterOptions, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  DISPLAY_NAME_FIELD_REGISTER_RULES,
  NAME_FIELD_REGISTER_RULES,
} from '../../../../constants/Form.constants';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { Include } from '../../../../generated/type/include';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { createPersona } from '../../../../rest/PersonaAPI';
import { getUserById } from '../../../../rest/userAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import RichTextEditor from '../../../common/RichTextEditor/RichTextEditor';
import { UserSelectableList } from '../../../common/UserSelectableList/UserSelectableList.component';
import { UserTag } from '../../../common/UserTag/UserTag.component';
import { UserTagSize } from '../../../common/UserTag/UserTag.interface';
import { AddPersonaFormProps } from './AddEditPersona.interface';

interface PersonaFormValues {
  name: string;
  displayName: string;
  users: EntityReference[];
}

type TextFieldName = 'name' | 'displayName';

export const AddEditPersonaForm = ({
  onCancel,
  onSave,
}: AddPersonaFormProps) => {
  const { t } = useTranslation();
  // Validate while typing, as the antd form did.
  const form = useForm<PersonaFormValues>({
    mode: 'onChange',
    defaultValues: { name: '', displayName: '', users: [] },
  });
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { currentUser, setCurrentUser } = useApplicationStore();
  const usersList = form.watch('users');

  const fetchCurrentUser = async () => {
    if (!currentUser) {
      return;
    }
    try {
      const user = await getUserById(currentUser.id, {
        fields: [TabSpecificField.PERSONAS],
        include: Include.All,
      });
      setCurrentUser({ ...currentUser, ...user });
    } catch {
      return;
    }
  };

  const handleSubmit = async (data: PersonaFormValues) => {
    try {
      setIsSaving(true);
      await createPersona({
        name: trim(data.name),
        displayName: trim(data.displayName) || undefined,
        description,
        users: data.users.map((user) => user.id),
      });
      await fetchCurrentUser();
      onSave();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  const renderTextField = (
    name: TextFieldName,
    label: string,
    rules: RegisterOptions<PersonaFormValues, TextFieldName>
  ) => (
    <FormField control={form.control} name={name} rules={rules}>
      {({ field, fieldState }) => (
        <Input
          autoComplete="off"
          hint={fieldState.error?.message}
          inputDataTestId={name}
          isInvalid={fieldState.invalid}
          isRequired={Boolean(rules.required)}
          label={label}
          placeholder={label}
          value={field.value}
          onBlur={field.onBlur}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );

  return (
    <SimpleModal
      isOpen
      cancelText={t('label.cancel')}
      data-testid="add-edit-persona-modal"
      isDismissable={false}
      isOkLoading={isSaving}
      okText={t('label.create')}
      title={t('label.add-entity', { entity: t('label.persona') })}
      width={750}
      onCancel={onCancel}
      onOk={form.handleSubmit(handleSubmit)}>
      <>
        <HookForm
          className="tw:flex tw:flex-col tw:gap-4"
          form={form}
          onSubmit={form.handleSubmit(handleSubmit)}>
          {renderTextField('name', t('label.name'), NAME_FIELD_REGISTER_RULES)}
          {renderTextField(
            'displayName',
            t('label.display-name'),
            DISPLAY_NAME_FIELD_REGISTER_RULES
          )}
          <Box direction="col" gap={1}>
            <FormItemLabel label={t('label.description')} />
            <RichTextEditor
              data-testid="description"
              initialValue=""
              onTextChange={setDescription}
            />
          </Box>
          <FormField control={form.control} name="users">
            {({ field }) => (
              <Box direction="col" gap={1}>
                <Box align="center" gap={2}>
                  <FormItemLabel label={t('label.user-plural')} />
                  <UserSelectableList
                    hasPermission
                    multiSelect
                    selectedUsers={field.value}
                    onUpdate={async (users) => field.onChange(users ?? [])}>
                    <Button
                      aria-label={t('label.add-entity', {
                        entity: t('label.user-plural'),
                      })}
                      color="primary"
                      data-testid="add-users"
                      iconLeading={Plus}
                      size="xs"
                    />
                  </UserSelectableList>
                </Box>
                {usersList.length > 0 && (
                  <Box
                    align="center"
                    data-testid="users-container"
                    gap={2}
                    wrap="wrap">
                    {usersList.map((user) => (
                      <UserTag
                        id={user.name ?? user.id}
                        key={user.id}
                        name={getEntityName(user)}
                        size={UserTagSize.small}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </FormField>
        </HookForm>
      </>
    </SimpleModal>
  );
};
