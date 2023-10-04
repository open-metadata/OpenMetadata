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

import { Form, Select } from 'antd';
import { useForm } from 'antd/es/form/Form';
import Modal from 'antd/lib/modal/Modal';
import { compare } from 'fast-json-patch';
import { isEmpty, map } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { Document } from '../../../generated/entity/docStore/document';
import { FieldTypes } from '../../../interface/FormUtils.interface';
import { CustomEntityType } from '../../../pages/CustomPageSettings/CustomPageSettings.interface';
import { createDocument, udpateDocument } from '../../../rest/DocStoreAPI';
import { generateFormFields } from '../../../utils/formUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AddEditCustomisePageProps } from './AddEditCustomizePage.interface';

export const AddEditCustomizePage = ({
  onCancel,
  onSave,
  page,
}: AddEditCustomisePageProps) => {
  const [form] = useForm();
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  //   const usersList = Form.useWatch<EntityReference[]>('users', form) ?? [];
  const isEditMode = !isEmpty(page);

  const handleSave = useCallback(
    async (data: Document) => {
      try {
        setIsSaving(true);
        const updatedData = {
          ...page,
          ...data,
          entityType: 'KnowledgePanel',
          fullyQualifiedName: `KnowledgePanel.${data.entityType}`,
          data: {
            knowledgePanel: {
              entityType: data.entityType,
              size: ['small', 'medium', 'large'],
              position: {
                row: 1,
                column: 1,
              },
            },
          },
        };
        if (page && isEditMode) {
          const jsonPatch = compare(page, updatedData);

          await udpateDocument(page?.id ?? '', jsonPatch);
        } else {
          await createDocument(updatedData);
        }
        onSave();
      } catch (error) {
        showErrorToast(error);
      } finally {
        setIsSaving(false);
      }
    },
    [isEditMode, page]
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
        rules: [
          {
            pattern: ENTITY_NAME_REGEX,
            message: t('message.custom-property-name-validation'),
          },
        ],
      },
      {
        name: 'displayName',
        required: true,
        label: t('label.display-name'),
        id: 'root/displayName',
        type: FieldTypes.TEXT,
        props: {
          'data-testid': 'displayName',
          initialValue: '',
        },
      },
      {
        name: 'description',
        required: true,
        label: t('label.description'),
        id: 'root/description',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'description',
          initialValue: '',
        },
      },
    ],
    []
  );

  return (
    <Modal
      centered
      open
      cancelText={t('label.cancel')}
      confirmLoading={isSaving}
      okText={t('label.create')}
      title={isEmpty(page) ? 'Add Page' : 'Edit Page'}
      width={750}
      onCancel={onCancel}
      onOk={() => form.submit()}>
      <Form
        form={form}
        initialValues={page}
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSave}>
        {generateFormFields(fields)}
        <Form.Item name="entityType">
          <Select
            options={map(CustomEntityType, (type) => ({
              label: type,
              value: type,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
