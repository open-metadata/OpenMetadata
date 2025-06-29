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
import { Button, Form, FormProps, Space } from 'antd';
import { omit } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { HEX_COLOR_CODE_REGEX } from '../../../constants/regex.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  CreateDataProduct,
  TagSource,
} from '../../../generated/api/domains/createDataProduct';
import {
  CreateDomain,
  DomainType,
} from '../../../generated/api/domains/createDomain';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/entity/type';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { domainTypeTooltipDataRender } from '../../../utils/DomainUtils';
import { generateFormFields, getField } from '../../../utils/formUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import '../domain.less';
import { DomainFormType } from '../DomainPage.interface';
import { AddDomainFormProps } from './AddDomainForm.interface';

const AddDomainForm = ({
  isFormInDialog,
  loading,
  onCancel,
  onSubmit,
  formRef,
  type,
}: AddDomainFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm(formRef);
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
      rules: NAME_FIELD_RULES,
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
    {
      name: 'tags',
      required: false,
      label: t('label.tag-plural'),
      id: 'root/tags',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        selectProps: {
          'data-testid': 'tags-container',
        },
      },
    },
    {
      name: 'glossaryTerms',
      required: false,
      label: t('label.glossary-term-plural'),
      id: 'root/glossaryTerms',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        selectProps: {
          'data-testid': 'glossary-terms-container',
        },
        open: false,
        hasNoActionButtons: true,
        isTreeSelect: true,
        tagType: TagSource.Glossary,
        placeholder: t('label.select-field', {
          field: t('label.glossary-term-plural'),
        }),
      },
    },
    {
      name: 'iconURL',
      id: 'root/iconURL',
      label: t('label.icon-url'),
      required: false,
      placeholder: t('label.icon-url'),
      type: FieldTypes.TEXT,
      helperText: t('message.govern-url-size-message'),
      props: {
        'data-testid': 'icon-url',
      },
    },
    {
      name: 'color',
      id: 'root/color',
      label: t('label.color'),
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
    },
  ];

  if (type === DomainFormType.DOMAIN || type === DomainFormType.SUBDOMAIN) {
    const domainTypeField: FieldProp = {
      name: 'domainType',
      required: true,
      label: t('label.domain-type'),
      id: 'root/domainType',
      type: FieldTypes.SELECT,
      helperText: domainTypeTooltipDataRender(),
      props: {
        'data-testid': 'domainType',
        options: domainTypeArray,
        overlayClassName: 'domain-type-tooltip-container',
        tooltipPlacement: 'topLeft',
        tooltipAlign: { targetOffset: [18, 0] },
      },
    };

    formFields.push(domainTypeField);
  }

  const ownerField: FieldProp = {
    name: 'owners',
    id: 'root/owner',
    required: false,
    label: t('label.owner-plural'),
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
      multiple: { user: true, team: false },
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'owners',
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
    formItemLayout: FormItemLayout.HORIZONTAL,
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

  const selectedOwners =
    Form.useWatch<EntityReference | EntityReference[]>('owners', form) ?? [];

  const ownersList = Array.isArray(selectedOwners)
    ? selectedOwners
    : [selectedOwners];

  const expertsList = Form.useWatch<EntityReference[]>('experts', form) ?? [];

  const handleFormSubmit: FormProps['onFinish'] = (formData) => {
    const updatedData = omit(formData, 'color', 'iconURL', 'glossaryTerms');
    const style = {
      color: formData.color,
      iconURL: formData.iconURL,
    };

    const data = {
      ...updatedData,
      style,
      experts: expertsList.map((item) => item.name ?? ''),
      owners: ownersList ?? [],
      tags: [...(formData.tags ?? []), ...(formData.glossaryTerms ?? [])],
    } as CreateDomain | CreateDataProduct;

    onSubmit(data);
  };

  return (
    <Form
      data-testid="add-domain"
      form={form}
      layout="vertical"
      onFinish={handleFormSubmit}>
      {generateFormFields(formFields)}
      <div className="m-t-xss">
        {getField(ownerField)}
        {Boolean(ownersList.length) && (
          <Space wrap data-testid="owner-container" size={[8, 8]}>
            <OwnerLabel owners={ownersList} />
          </Space>
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
            <OwnerLabel owners={expertsList} />
          </Space>
        )}
      </div>

      {!isFormInDialog && (
        <Space
          className="w-full justify-end"
          data-testid="cta-buttons"
          size={16}>
          <Button data-testid="cancel-domain" type="link" onClick={onCancel}>
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
  );
};

export default AddDomainForm;
