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
import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Tooltip,
  Typography,
} from 'antd';
import { get, isUndefined, uniq } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import {
  ENTITY_REFERENCE_OPTIONS,
  ENUM_WITH_DESCRIPTION,
  PROPERTY_TYPES_WITH_ENTITY_REFERENCE,
} from '../../../../constants/CustomProperty.constants';
import {
  CustomProperty,
  EnumConfig,
  ValueClass,
} from '../../../../generated/type/customProperty';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../../utils/formUtils';
import RichTextEditor from '../../../common/RichTextEditor/RichTextEditor';

export interface FormData {
  description: string;
  customPropertyConfig: string[] | ValueClass[];
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

  const {
    hasEnumConfig,
    hasEntityReferenceConfig,
    hasEnumWithDescriptionConfig,
  } = useMemo(() => {
    const propertyName = customProperty.propertyType.name ?? '';
    const hasEnumConfig = propertyName === 'enum';
    const hasEnumWithDescriptionConfig = propertyName === ENUM_WITH_DESCRIPTION;
    const hasEntityReferenceConfig =
      PROPERTY_TYPES_WITH_ENTITY_REFERENCE.includes(propertyName);

    return {
      hasEnumConfig,
      hasEntityReferenceConfig,
      hasEnumWithDescriptionConfig,
    };
  }, [customProperty]);

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

  const enumConfigField: FieldProp = {
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

  const entityReferenceConfigField: FieldProp = {
    name: 'customPropertyConfig',
    required: false,
    label: t('label.entity-reference-types'),
    id: 'root/customPropertyConfig',
    type: FieldTypes.SELECT,
    props: {
      'data-testid': 'customPropertyConfig',
      mode: 'multiple',
      options: ENTITY_REFERENCE_OPTIONS,
      placeholder: t('label.entity-reference-types'),
      onChange: (value: string[]) => {
        const entityReferenceConfig = customProperty.customPropertyConfig
          ?.config as string[];
        const updatedValues = uniq([
          ...value,
          ...(entityReferenceConfig ?? []),
        ]);
        form.setFieldsValue({ customPropertyConfig: updatedValues });
      },
    },
    rules: [
      {
        required: true,
        message: t('label.field-required', {
          field: t('label.entity-reference-types'),
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
    if (hasEnumConfig || hasEnumWithDescriptionConfig) {
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
  }, [customProperty, hasEnumConfig, hasEnumWithDescriptionConfig]);

  const note = (
    <Typography.Text
      className="text-grey-muted"
      style={{ display: 'block', marginTop: '-18px' }}>
      {`Note: ${t(
        'message.updating-existing-not-possible-can-add-new-values'
      )}`}
    </Typography.Text>
  );

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
      width={800}
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
            {hasEnumConfig && (
              <>
                {generateFormFields([enumConfigField])}
                {note}
                {generateFormFields([multiSelectField])}
              </>
            )}

            {hasEnumWithDescriptionConfig && (
              <>
                <Form.List name="customPropertyConfig">
                  {(fields, { add, remove }) => {
                    const config =
                      (initialValues?.customPropertyConfig as ValueClass[]) ??
                      [];

                    return (
                      <>
                        <Form.Item
                          className="form-item-horizontal"
                          colon={false}
                          label={
                            <div className="d-flex gap-2 items-center">
                              <span>{t('label.property')}</span>
                              <Tooltip
                                title={t(
                                  'message.enum-with-description-update-note'
                                )}>
                                <InfoCircleOutlined
                                  className="m-x-xss"
                                  style={{ color: '#C4C4C4' }}
                                />
                              </Tooltip>
                            </div>
                          }>
                          <Button
                            data-testid="add-enum-description-config"
                            icon={
                              <PlusOutlined
                                style={{ color: 'white', fontSize: '12px' }}
                              />
                            }
                            size="small"
                            type="primary"
                            onClick={() => {
                              add();
                            }}
                          />
                        </Form.Item>

                        {fields.map((field, index) => {
                          const isExisting = Boolean(get(config, index, false));

                          return (
                            <Row
                              className="m-t-md"
                              gutter={[8, 0]}
                              key={field.key}>
                              <Col span={23}>
                                <Row gutter={[8, 0]}>
                                  <Col span={24}>
                                    <Form.Item
                                      name={[field.name, 'key']}
                                      rules={[
                                        {
                                          required: true,
                                          message: `${t(
                                            'message.field-text-is-required',
                                            {
                                              fieldText: t('label.key'),
                                            }
                                          )}`,
                                        },
                                      ]}>
                                      <Input
                                        disabled={isExisting}
                                        id={`name-${index}`}
                                        placeholder={t('label.key')}
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col span={24}>
                                    <Form.Item
                                      name={[field.name, 'description']}
                                      rules={[
                                        {
                                          required: true,
                                          message: `${t(
                                            'message.field-text-is-required',
                                            {
                                              fieldText: t('label.description'),
                                            }
                                          )}`,
                                        },
                                      ]}
                                      trigger="onTextChange"
                                      valuePropName="initialValue">
                                      <RichTextEditor height="200px" />
                                    </Form.Item>
                                  </Col>
                                </Row>
                              </Col>
                              {!isExisting && (
                                <Col span={1}>
                                  <Button
                                    data-testid={`remove-enum-description-config-${index}`}
                                    icon={<DeleteIcon width={16} />}
                                    size="small"
                                    type="text"
                                    onClick={() => {
                                      remove(field.name);
                                    }}
                                  />
                                </Col>
                              )}
                            </Row>
                          );
                        })}
                      </>
                    );
                  }}
                </Form.List>

                {generateFormFields([multiSelectField])}
              </>
            )}

            {hasEntityReferenceConfig && (
              <>
                {generateFormFields([entityReferenceConfigField])}
                {note}
              </>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default EditCustomPropertyModal;
