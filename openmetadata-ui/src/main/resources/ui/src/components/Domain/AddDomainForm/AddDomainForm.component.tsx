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
import { UserTag } from 'components/common/UserTag/UserTag.component';
import { UserTagSize } from 'components/common/UserTag/UserTag.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ENTITY_NAME_REGEX } from 'constants/regex.constants';
import { CreateDataProduct } from 'generated/api/domains/createDataProduct';
import { CreateDomain, DomainType } from 'generated/api/domains/createDomain';
import { Operation } from 'generated/entity/policies/policy';
import { EntityReference } from 'generated/entity/type';
import { FieldProp, FieldTypes } from 'interface/FormUtils.interface';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import { generateFormFields, getField } from 'utils/formUtils';
import { checkPermission } from 'utils/PermissionsUtils';
import { DomainFormType } from '../DomainPage.interface';
import { AddDomainFormProps } from './AddDomainForm.interface';

const AddDomainForm = ({
  isFormInDialog,
  loading,
  onCancel,
  onSubmit,
  formRef: form,
  type,
}: AddDomainFormProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();

  const domainTypeArray = Object.keys(DomainType).map((key) => ({
    key,
    value: DomainType[key as keyof typeof DomainType],
  }));

  const formFields: FieldProp[] = [
    {
      name: 'name',
      id: 'root/name',
      label: t('label.name'),
      required: true,
      placeholder: t('label.name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'name',
      },
      rules: [
        {
          pattern: ENTITY_NAME_REGEX,
          message: t('message.entity-name-validation'),
        },
        {
          min: 1,
          max: 128,
          message: `${t('message.entity-maximum-size', {
            entity: `${t('label.name')}`,
            max: '128',
          })}`,
        },
      ],
    },
    {
      name: 'displayName',
      id: 'root/displayName',
      label: t('label.display-name'),
      required: false,
      placeholder: t('label.display-name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'display-name',
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
        height: 'auto',
      },
    },
  ];

  if (type === DomainFormType.DOMAIN) {
    const domainTypeField: FieldProp = {
      name: 'domainType',
      required: true,
      label: t('label.domain-type'),
      id: 'root/domainType',
      type: FieldTypes.SELECT,
      props: {
        'data-testid': 'domainType',
        options: domainTypeArray,
      },
    };

    formFields.push(domainTypeField);
  }

  const ownerField: FieldProp = {
    name: 'owner',
    id: 'root/owner',
    required: false,
    label: t('label.owner'),
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      hasPermission: true,
      children: (
        <Button
          data-testid="add-owner"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: 'horizontal',
    formItemProps: {
      valuePropName: 'owner',
      trigger: 'onUpdate',
    },
  };

  const expertsField: FieldProp = {
    name: 'experts',
    id: 'root/experts',
    required: false,
    label: t('label.expert-plural'),
    type: FieldTypes.USER_MULTI_SELECT,
    props: {
      hasPermission: true,
      popoverProps: { placement: 'topLeft' },
      children: (
        <Button
          data-testid="add-experts"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: 'horizontal',
    formItemProps: {
      valuePropName: 'selectedUsers',
      trigger: 'onUpdate',
      initialValue: [],
    },
  };

  const createPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const selectedOwner = Form.useWatch<EntityReference | undefined>(
    'owner',
    form
  );

  const expertsList = Form.useWatch<EntityReference[]>('experts', form) ?? [];

  const handleFormSubmit = (formData: CreateDomain | CreateDataProduct) => {
    const data = {
      ...formData,
      experts: expertsList.map((item) => item.name),
    };
    onSubmit(data as CreateDomain | CreateDataProduct);
  };

  return (
    <>
      <div data-testid="add-domain">
        <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
          {generateFormFields(formFields)}
          <div className="m-t-xss">
            {getField(ownerField)}
            {selectedOwner && (
              <div className="m-b-sm" data-testid="owner-container">
                <UserTag
                  id={selectedOwner.id}
                  name={getEntityName(selectedOwner)}
                  size={UserTagSize.small}
                />
              </div>
            )}
          </div>
          <div className="m-t-xss">
            {getField(expertsField)}
            {Boolean(expertsList.length) && (
              <Space
                wrap
                className="m-b-xs"
                data-testid="experts-container"
                size={[8, 8]}>
                {expertsList.map((d) => (
                  <UserTag
                    id={d.id}
                    key={'expert' + d.id}
                    name={getEntityName(d)}
                    size={UserTagSize.small}
                  />
                ))}
              </Space>
            )}
          </div>

          {!isFormInDialog && (
            <Space
              className="w-full justify-end"
              data-testid="cta-buttons"
              size={16}>
              <Button
                data-testid="cancel-domain"
                type="link"
                onClick={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="save-domain"
                disabled={!createPermission}
                htmlType="submit"
                loading={loading}
                type="primary">
                {t('label.save')}
              </Button>
            </Space>
          )}
        </Form>
      </div>
    </>
  );
};

export default AddDomainForm;
