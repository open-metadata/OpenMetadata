/*
 *  Copyright 2024 Collate.
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
import { Form, Modal, Typography } from 'antd';
import { isUndefined, uniq } from 'lodash';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../generated/type/customProperty';
import {
  FieldProp,
  FieldTypes,
} from '../../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../../utils/formUtils';

export interface FormData {
  description: string;
  customPropertyConfig: string[];
}

interface EditCustomPropertyModalProps {
  customProperty: CustomProperty;
  visible: boolean;
  onCancel: () => void;
  onSave: (data: FormData) => Promise<void>;
}

const EditCustomPropertyModal: FC<EditCustomPropertyModalProps> = ({
  customProperty,
  onCancel,
  visible,
  onSave,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSubmit = async (data: FormData) => {
    setIsSaving(true);
    await onSave(data);
    setIsSaving(false);
  };

  const formFields: FieldProp[] = [
    {
      name: 'description',
      required: true,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: customProperty.description,
      },
    },
  ];

  const customPropertyConfigField: FieldProp = {
    name: 'customPropertyConfig',
    required: true,
    label: t('label.config'),
    id: 'root/customPropertyConfig',
    type: FieldTypes.SELECT,
    props: {
      'data-testid': 'customPropertyConfig',
      mode: 'tags',
      placeholder: 'Config',
      onChange: (value: string[]) => {
        const updatedValues = uniq([
          ...value,
          ...(customProperty.customPropertyConfig?.config ?? []),
        ]);
        form.setFieldsValue({ customPropertyConfig: updatedValues });
      },
    },
  };

  return (
    <Modal
      centered
      destroyOnClose
      cancelButtonProps={{ disabled: isSaving }}
      closable={false}
      data-testid="edit-custom-property-modal"
      maskClosable={false}
      okButtonProps={{
        htmlType: 'submit',
        form: 'edit-custom-property-form',
        loading: isSaving,
      }}
      okText={t('label.save')}
      open={visible}
      title={
        <Typography.Text>
          {t('label.edit-entity-name', {
            entityType: t('label.property'),
            entityName: customProperty.name,
          })}
        </Typography.Text>
      }
      width={750}
      onCancel={onCancel}>
      <Form
        form={form}
        id="edit-custom-property-form"
        initialValues={{
          description: customProperty.description,
          customPropertyConfig: customProperty.customPropertyConfig?.config,
        }}
        layout="vertical"
        onFinish={handleSubmit}>
        {generateFormFields(formFields)}
        {!isUndefined(customProperty.customPropertyConfig) && (
          <>
            {generateFormFields([customPropertyConfigField])}
            <Typography.Text
              className="text-grey-muted"
              style={{ display: 'block', marginTop: '-18px' }}>
              {`Note: ${t(
                'message.updating-existing-not-possible-can-add-new-values'
              )}`}
            </Typography.Text>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default EditCustomPropertyModal;
