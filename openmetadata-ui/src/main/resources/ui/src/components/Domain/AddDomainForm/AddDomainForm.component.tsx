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
import { Box } from '@mui/material';
import { Button, Col, Form, FormProps, Row, Space } from 'antd';
import { omit } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import imageClassBase from '../../../components/BlockEditor/Extensions/image/ImageClassBase';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
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
import {
  domainTypeTooltipDataRender,
  iconTooltipDataRender,
} from '../../../utils/DomainUtils';
import { generateFormFields, getField } from '../../../utils/formUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  DEFAULT_DATA_PRODUCT_ICON,
  DEFAULT_DOMAIN_ICON,
} from '../../common/IconPicker';
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
  parentDomain,
}: AddDomainFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm(formRef);
  const { permissions } = usePermissionProvider();

  const domainTypeArray = Object.keys(DomainType).map((key) => ({
    label: key,
    value: DomainType[key as keyof typeof DomainType],
  }));

  const selectedColor = Form.useWatch('color', form);

  // Check if upload functionality is available (for showing/hiding cover image field)
  const { onImageUpload } =
    imageClassBase.getBlockEditorAttachmentProps() ?? {};
  const isCoverImageUploadAvailable = !!onImageUpload;

  // Separate fields for custom layout
  const coverImageField: FieldProp | null = isCoverImageUploadAvailable
    ? {
        name: 'coverImage',
        id: 'root/coverImage',
        label: t('label.cover-image'),
        muiLabel: t('label.cover-image'),
        required: false,
        type: FieldTypes.COVER_IMAGE_UPLOAD_MUI,
        props: {
          'data-testid': 'cover-image',
          maxSizeMB: 5,
          maxDimensions: { width: 800, height: 400 },
          // NO onUpload prop - this makes MUICoverImageUpload store file locally
          // Parent component will handle upload after domain is created
        },
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      }
    : null;

  const iconField: FieldProp = {
    name: 'iconURL',
    id: 'root/iconURL',
    label: t('label.icon'),
    muiLabel: t('label.icon'),
    required: false,
    type: FieldTypes.ICON_PICKER_MUI,
    helperText: iconTooltipDataRender(),
    props: {
      'data-testid': 'icon-url',
      allowUrl: true,
      placeholder: t('label.icon-url'),
      backgroundColor: selectedColor,
      defaultIcon:
        type === DomainFormType.DATA_PRODUCT
          ? DEFAULT_DATA_PRODUCT_ICON
          : DEFAULT_DOMAIN_ICON,
      customStyles: {
        searchBoxWidth: 366,
      },
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
    },
  };

  const colorField: FieldProp = {
    name: 'color',
    id: 'root/color',
    label: t('label.color'),
    muiLabel: t('label.color'),
    required: false,
    type: FieldTypes.COLOR_PICKER_MUI,
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
    },
  };

  const nameField: FieldProp = {
    name: 'name',
    id: 'root/name',
    label: t('label.name'),
    required: true,
    placeholder: t('label.name'),
    type: FieldTypes.TEXT_MUI,
    props: {
      'data-testid': 'name',
    },
    rules: NAME_FIELD_RULES,
  };

  const displayNameField: FieldProp = {
    name: 'displayName',
    id: 'root/displayName',
    label: t('label.display-name'),
    required: false,
    placeholder: t('label.display-name'),
    type: FieldTypes.TEXT_MUI,
    props: {
      'data-testid': 'display-name',
    },
  };

  const formFields: FieldProp[] = useMemo(
    () => [
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
          className: 'add-domain-form-description new-form-style',
        },
      },
      {
        name: 'tags',
        required: false,
        label: t('label.tag-plural'),
        id: 'root/tags',
        type: FieldTypes.TAG_SUGGESTION_MUI,
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
        type: FieldTypes.GLOSSARY_TAG_SUGGESTION_MUI,
        props: {
          placeholder: t('label.select-field', {
            field: t('label.glossary-term-plural'),
          }),
        },
      },
    ],
    [t]
  );

  const additionalFields: FieldProp[] = useMemo(() => {
    const fields: FieldProp[] = [];

    if (type === DomainFormType.DOMAIN || type === DomainFormType.SUBDOMAIN) {
      const domainTypeField: FieldProp = {
        name: 'domainType',
        required: true,
        label: t('label.domain-type'),
        id: 'root/domainType',
        type: FieldTypes.SELECT_MUI,
        helperText: domainTypeTooltipDataRender(),
        props: {
          'data-testid': 'domainType',
          options: domainTypeArray,
          overlayClassName: 'domain-type-tooltip-container',
          tooltipPlacement: 'top-start',
          tooltipAlign: { targetOffset: [18, 0] },
          slotProps: {
            tooltip: {
              sx: {
                bgcolor: '#fff',
                color: '#000',
              },
            },
            arrow: {
              sx: {
                color: '#fff',
              },
            },
          },
        },
        placeholder: t('label.select-entity', {
          entity: t('label.domain-type'),
        }),
      };

      fields.push(domainTypeField);
    }

    // Add domain selection field for Data Products ONLY when NOT in domain context
    if (type === DomainFormType.DATA_PRODUCT && !parentDomain) {
      const domainField: FieldProp = {
        name: 'domains',
        required: true,
        label: t('label.domain'),
        muiLabel: t('label.domain'),
        id: 'root/domains',
        type: FieldTypes.DOMAIN_SELECT_MUI,
        props: {
          'data-testid': 'domain-select',
          hasPermission: true,
          multiple: false,
        },
        formItemLayout: FormItemLayout.HORIZONTAL,
        formItemProps: {
          valuePropName: 'value',
          trigger: 'onChange',
        },
      };

      fields.push(domainField);
    }

    return fields;
  }, [type, parentDomain, domainTypeArray, t]);

  const ownerField: FieldProp = {
    name: 'owners',
    id: 'root/owner',
    required: false,
    label: t('label.owner-plural'),
    type: FieldTypes.USER_TEAM_SELECT_MUI,
    props: {
      multipleUser: true,
      multipleTeam: false,
      label: t('label.owner-plural'),
    },
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
    },
  };

  const expertsField: FieldProp = {
    name: 'experts',
    id: 'root/experts',
    required: false,
    label: t('label.expert-plural'),
    type: FieldTypes.USER_TEAM_SELECT_MUI,
    props: {
      userOnly: true,
      multipleUser: true,
      label: t('label.expert-plural'),
    },
    formItemProps: {
      valuePropName: 'value',
      trigger: 'onChange',
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
    const updatedData = omit(
      formData,
      'color',
      'iconURL',
      'glossaryTerms'
      // Keep 'coverImage' - parent will extract and remove it before API call
      // Don't exclude 'domains' - we need it for DataProducts
    );
    const style = {
      color: formData.color,
      iconURL: formData.iconURL,
      // Don't include coverImage here - it's not uploaded yet
      // Parent will add it to style after upload
    };

    // Build the data object
    const data: CreateDomain | CreateDataProduct = {
      ...updatedData,
      style,
      experts: expertsList.map((item) => item.name ?? ''),
      owners: ownersList ?? [],
      tags: [...(formData.tags ?? []), ...(formData.glossaryTerms ?? [])],
    } as CreateDomain | CreateDataProduct;

    // Handle domains field based on form type
    if (type === DomainFormType.DATA_PRODUCT) {
      // For DataProduct, set domains as array
      if (formData.domains) {
        (data as CreateDataProduct).domains = [
          formData.domains.fullyQualifiedName,
        ];
      } else if (parentDomain?.fullyQualifiedName) {
        // If creating within a domain context, use parent domain
        (data as CreateDataProduct).domains = [parentDomain.fullyQualifiedName];
      }
    } else {
      // For Domain/SubDomain, remove domains field if it exists
      delete (data as CreateDomain & { domains?: unknown }).domains;
    }

    onSubmit(data)
      .then(() => form.resetFields())
      .catch(() => {
        // Form will not be reset on error
        // Error is already handled by parent component
      });
  };

  return (
    <Form
      data-testid="add-domain"
      form={form}
      layout="vertical"
      onFinish={handleFormSubmit}>
      {/* Cover Image */}
      {coverImageField && <Box sx={{ mb: 2 }}>{getField(coverImageField)}</Box>}

      {/* Icon and Color row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box>{getField(iconField)}</Box>
        <Box sx={{ ml: 'auto' }}>{getField(colorField)}</Box>
      </Box>

      {/* Name and Display Name row */}
      <Row gutter={16}>
        <Col span={12}>{getField(nameField)}</Col>
        <Col span={12}>{getField(displayNameField)}</Col>
      </Row>

      {/* Remaining fields */}
      {generateFormFields([...formFields, ...additionalFields])}
      <div className="m-t-xss">{getField(ownerField)}</div>
      <div className="m-t-xss">{getField(expertsField)}</div>

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
