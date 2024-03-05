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
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CustomProperty,
  EnumConfig,
} from '../../../../generated/type/customProperty';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../../utils/formUtils';

export interface FormData {
  description: string;
  customPropertyConfig: string[];
  multiSelect?: boolean;
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
    required: false,
    label: t('label.enum-value-plural'),
    id: 'root/customPropertyConfig',
    type: FieldTypes.SELECT,
    props: {
      'data-testid': 'customPropertyConfig',
      mode: 'tags',
      placeholder: t('label.enum-value-plural'),
      onChange: (value: string[]) => {
        const enumConfig = customProperty.customPropertyConfig
          ?.config as EnumConfig;
        const updatedValues = uniq([...value, ...(enumConfig?.values ?? [])]);
        form.setFieldsValue({ customPropertyConfig: updatedValues });
      },
    },
    rules: [
      {
        required: true,
        message: t('label.field-required', {
          field: t('label.enum-value-plural'),
        }),
      },
    ],
  };

  const multiSelectField: FieldProp = {
    name: 'multiSelect',
    label: t('label.multi-select'),
    type: FieldTypes.SWITCH,
    required: false,
    props: {
      'data-testid': 'multiSelect',
    },
    id: 'root/multiSelect',
    formItemLayout: FormItemLayout.HORIZONTAL,
  };

  const initialValues = useMemo(() => {
    const isEnumType = customProperty.propertyType.name === 'enum';
    if (isEnumType) {
      const enumConfig = customProperty.customPropertyConfig
        ?.config as EnumConfig;

      return {
        description: customProperty.description,
        customPropertyConfig: enumConfig?.values ?? [],
        multiSelect: Boolean(enumConfig?.multiSelect),
      };
    }

    return {
      description: customProperty.description,
      customPropertyConfig: customProperty.customPropertyConfig?.config,
    };
  }, [customProperty]);

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
        initialValues={initialValues}
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
            {generateFormFields([multiSelectField])}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default EditCustomPropertyModal;
