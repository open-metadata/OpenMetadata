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
  FieldProp,
  FieldTypes,
  FormFields,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ERROR_MESSAGE } from '../../../../../../constants/constants';
import { EntityReference } from '../../../../../../generated/entity/type';
import { createPersona } from '../../../../../../rest/PersonaAPI';
import { getIsErrorMatch } from '../../../../../../utils/APIUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import UserMultiSelect from './UserMultiSelect';

interface FormValues {
  name: string;
  displayName: string;
}

interface PersonaAddFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

const PersonaAddForm = ({ onCancel, onCreated }: PersonaAddFormProps) => {
  const { t } = useTranslation();
  const descEditorRef = useRef<EditorContentRef>(null);
  const [users, setUsers] = useState<EntityReference[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: { name: '', displayName: '' },
  });
  const { handleSubmit } = form;

  const fields: FieldProp[] = [
    {
      name: 'name',
      label: t('label.name'),
      type: FieldTypes.TEXT,
      required: true,
      placeholder: t('label.name'),
      props: { 'data-testid': 'persona-name-input' },
      rules: {
        required: t('label.field-required', { field: t('label.name') }),
      },
    },
    {
      name: 'displayName',
      label: t('label.display-name'),
      type: FieldTypes.TEXT,
      required: false,
      placeholder: t('label.display-name'),
      props: { 'data-testid': 'persona-display-name-input' },
    },
  ];

  const onSubmit = async (data: FormValues) => {
    const description = descEditorRef.current?.getEditorContent() ?? '';

    setIsSaving(true);
    try {
      await createPersona({
        name: data.name.trim(),
        displayName: data.displayName?.trim() || undefined,
        description,
        users: users.map((u) => u.id),
      });
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.persona') })
      );
      onCreated();
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.persona'),
              entityPlural: t('label.persona-plural'),
              name: data.name.trim(),
            })
          : (error as AxiosError)
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box className="tw:h-full tw:min-h-0" direction="col" justify="between">
      <HookForm form={form}>
        <Box
          className="tw:flex-1 tw:overflow-y-auto tw:px-8 tw:pt-0 tw:pb-6 tw:max-w-[640px] tw:w-full"
          data-testid="add-persona-container"
          direction="col"
          gap={5}>
          <FormFields fields={fields} />

          <Box direction="col" gap={1}>
            <Typography
              className="tw:text-secondary"
              size="text-sm"
              weight="medium">
              {t('label.description')}
            </Typography>
            <RichTextEditor
              className="new-form-style"
              data-testid="persona-description-input"
              placeHolder={t('message.write-your-description')}
              ref={descEditorRef}
            />
          </Box>

          <Box direction="col" gap={1}>
            <Typography
              className="tw:text-secondary"
              size="text-sm"
              weight="medium">
              {t('label.user-plural')}
            </Typography>
            <UserMultiSelect
              data-testid="persona-users-select"
              selectedUsers={users}
              onChange={setUsers}
            />
          </Box>
        </Box>
      </HookForm>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-8 tw:py-4"
        data-testid="add-persona-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-btn"
          isDisabled={isSaving}
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="submit-btn"
          isLoading={isSaving}
          onPress={() => handleSubmit(onSubmit)()}>
          {t('label.create')}
        </Button>
      </Box>
    </Box>
  );
};

export default PersonaAddForm;
