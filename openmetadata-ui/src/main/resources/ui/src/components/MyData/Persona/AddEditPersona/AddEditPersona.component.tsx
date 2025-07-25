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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Space } from 'antd';
import { useForm } from 'antd/es/form/Form';
import Modal from 'antd/lib/modal/Modal';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../../constants/constants';
import { NAME_FIELD_RULES } from '../../../../constants/Form.constants';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { Persona } from '../../../../generated/entity/teams/persona';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import { createPersona, updatePersona } from '../../../../rest/PersonaAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import { generateFormFields, getField } from '../../../../utils/formUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { UserTag } from '../../../common/UserTag/UserTag.component';
import { UserTagSize } from '../../../common/UserTag/UserTag.interface';
import { AddPersonaFormProps } from './AddEditPersona.interface';

export const AddEditPersonaForm = ({
  onCancel,
  onSave,
  persona,
}: AddPersonaFormProps) => {
  const [form] = useForm();
  const [isSaving, setIsSaving] = useState(false);
  const { refetchCurrentUser } = useApplicationStore();
  const { t } = useTranslation();

  const usersList =
    Form.useWatch<EntityReference[]>('users', form) ?? persona?.users ?? [];
  const isEditMode = !isEmpty(persona);

  const handleSubmit = useCallback(
    async (data: Persona) => {
      try {
        setIsSaving(true);
        const { users } = data;

        const usersList = users?.map((u) => u.id) ?? [];
        const domains = data.domains
          ?.map((d) => d.fullyQualifiedName)
          .filter(Boolean) as string[];
        if (persona && isEditMode) {
          const jsonPatch = compare(persona, data);

          await updatePersona(persona?.id, jsonPatch);
        } else {
          await createPersona({ ...data, users: usersList, domains });
        }
        refetchCurrentUser({
          fields: [TabSpecificField.PERSONAS],
        });
        onSave();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [isEditMode, persona]
  );

  const fields = useMemo(
    () => [
      {
        name: 'name',
        required: true,
        label: t('label.name'),
        id: 'root/name',
        type: FieldTypes.TEXT,
        props: {
          'data-testid': 'name',
          autoComplete: 'off',
        },
        placeholder: t('label.name'),
        rules: NAME_FIELD_RULES,
      },
      {
        name: 'displayName',
        required: false,
        label: t('label.display-name'),
        id: 'root/displayName',
        type: FieldTypes.TEXT,
        props: {
          'data-testid': 'displayName',
          autoComplete: 'off',
        },
        placeholder: t('label.display-name'),
      },
      {
        name: 'description',
        required: false,
        label: t('label.description'),
        id: 'root/description',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'description',
          initialValue: '',
          height: 'auto',
        },
      },
    ],
    []
  );

  const usersField = useMemo(
    () => ({
      name: 'users',
      required: false,
      label: t('label.user-plural'),
      id: 'root/users',
      formItemProps: {
        valuePropName: 'selectedUsers',
        trigger: 'onUpdate',
        initialValue: [],
      },
      formItemLayout: FormItemLayout.HORIZONTAL,
      type: FieldTypes.USER_MULTI_SELECT,
      props: {
        'data-testid': 'user',
        hasPermission: true,
        children: (
          <Button
            data-testid="add-users"
            icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
            size="small"
            type="primary"
          />
        ),
      },
    }),
    []
  );

  const handleSave = useCallback(() => form?.submit(), [form]);

  return (
    <Modal
      centered
      destroyOnClose
      open
      cancelText={t('label.cancel')}
      closable={false}
      closeIcon={null}
      confirmLoading={isSaving}
      data-testid="add-edit-persona-modal"
      okText={isEditMode ? t('label.update') : t('label.create')}
      title={isEmpty(persona) ? 'Add Persona' : 'Edit Persona'}
      width={750}
      onCancel={onCancel}
      onOk={handleSave}>
      <Form
        form={form}
        initialValues={persona}
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSubmit}>
        {generateFormFields(fields)}
        <div>
          {getField(usersField)}
          {Boolean(usersList.length) && (
            <Space
              wrap
              className="m--t-md"
              data-testid="users-container"
              size={[8, 8]}>
              {usersList.map((d) => (
                <UserTag
                  id={d.name ?? d.id}
                  key={d.id}
                  name={getEntityName(d)}
                  size={UserTagSize.small}
                />
              ))}
            </Space>
          )}
        </div>
      </Form>
    </Modal>
  );
};
